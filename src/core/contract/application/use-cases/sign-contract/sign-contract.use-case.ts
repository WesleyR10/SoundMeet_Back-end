import { IBandRepository } from "../../../../musician/domain/band.repository";
import { assertNegotiationParticipant } from "../../../../scheduling/application/use-cases/common/negotiation-actor";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Contract, ContractId } from "../../../domain/contract.aggregate";
import { IContractRepository } from "../../../domain/contract.repository";
import { ContractPartyRole } from "../../../domain/contract-types";
import { IContractRenderer } from "../../ports/contract-renderer.port";
import { IContractSignatureChallenge } from "../../ports/contract-signature-challenge.port";
import { IContractSignatureProvider } from "../../ports/contract-signature-provider.port";
import { IContractStorage } from "../../ports/contract-storage.interface";
import {
  ContractOutput,
  ContractOutputMapper,
} from "../common/contract-output";
import { resolveSigningRole } from "../common/resolve-signing-role";
import { SignContractInput } from "./sign-contract.input";

/**
 * Assinatura eletrônica de um dos lados.
 *
 * ## Autorização por reúso, não por reimplementação
 *
 * `Contract` tem exatamente o formato de `NegotiationSides`
 * (`establishment_id`/`musician_id`/`band_id`), então a autorização é o mesmo
 * `assertNegotiationParticipant` que protege confirmar e cancelar um booking —
 * incluindo a regra de que **em banda só o líder decide**. Reimplementar essa
 * lógica aqui abriria a porta para as duas divergirem, e assinar é uma decisão
 * tão vinculante quanto confirmar.
 *
 * Import cross-contexto na camada de aplicação tem precedente:
 * `ReviewEligibilityService` atravessa quatro contextos.
 *
 * ## Por que o papel é derivado, e não recebido
 *
 * Quem assina como CONTRATANTE é quem opera aquele estabelecimento; como
 * CONTRATADO, o músico ou o líder da banda. Deixar o cliente escolher o papel
 * permitiria ao estabelecimento assinar pelos dois lados e declarar o contrato
 * fechado sozinho.
 */
export type SignContractOutput = ContractOutput;

export type SignContractDeps = {
  contractRepo: IContractRepository;
  challenge: IContractSignatureChallenge;
  signatureProvider: IContractSignatureProvider;
  renderer: IContractRenderer;
  storage: IContractStorage;
  bandRepo?: IBandRepository;
  domainEventMediator?: DomainEventMediator;
};

export class SignContractUseCase implements IUseCase<
  SignContractInput,
  SignContractOutput
> {
  constructor(private readonly deps: SignContractDeps) {}

  async execute(input: SignContractInput): Promise<SignContractOutput> {
    if (input.accept_terms !== true) {
      throw new EntityValidationError([
        {
          accept_terms: [
            "É necessário declarar expressamente a concordância com os termos do contrato.",
          ],
        },
      ]);
    }

    const contract = await this.deps.contractRepo.findById(
      new ContractId(input.contract_id),
    );
    if (!contract) {
      throw new NotFoundError(input.contract_id, Contract);
    }

    await assertNegotiationParticipant(
      {
        requesting_participant_ids: input.requesting_participant_ids,
        requesting_musician_id: input.requesting_musician_id,
        is_admin: input.is_admin,
      },
      {
        establishment_id: contract.establishment_id.id,
        musician_id: contract.musician_id?.id ?? null,
        band_id: contract.band_id?.id ?? null,
      },
      "assinar este contrato",
      this.deps.bandRepo,
    );

    const role = resolveSigningRole(contract, input.requesting_participant_ids);

    /*
     * Consumir o código ANTES de capturar a assinatura.
     *
     * A ordem importa: `consume` apaga o código no sucesso, então uma falha
     * posterior obriga a pedir outro. O inverso — assinar e depois validar —
     * deixaria uma janela em que a assinatura existe sem o segundo fator ter
     * sido conferido.
     */
    await this.deps.challenge.consume(
      {
        contract_id: contract.contract_id.id,
        role,
        signer_user_id: input.requesting_user_id,
      },
      input.challenge_code,
    );

    const evidence = await this.deps.signatureProvider.captureSignature({
      contract_id: contract.contract_id.id,
      signer_user_id: input.requesting_user_id,
      observed_ip: input.observed_ip ?? null,
      forwarded_for: input.forwarded_for ?? null,
      user_agent: input.user_agent ?? null,
    });

    contract.sign({
      role,
      signer_user_id: input.requesting_user_id,
      signed_at: evidence.signed_at,
      ip: evidence.ip,
      ip_source: evidence.ip_source,
      forwarded_for: evidence.forwarded_for,
      user_agent: evidence.user_agent,
    });

    if (contract.notification.hasErrors()) {
      throw new EntityValidationError(contract.notification.toJSON());
    }

    /*
     * O certificado (Anexo II) só nasce quando os DOIS assinaram: ele contém a
     * trilha completa, e gerá-lo a cada assinatura produziria um documento que
     * se contradiz.
     *
     * Renderizar e subir ANTES do update do agregado segue o mesmo precedente
     * do upload de cardápio: arquivo órfão em caso de falha é preferível a um
     * contrato marcado como certificado sem certificado nenhum.
     */
    if (contract.isFullySigned) {
      const certificateKey = await this.renderCertificate(contract);
      contract.attachCertificate(certificateKey);

      if (contract.notification.hasErrors()) {
        throw new EntityValidationError(contract.notification.toJSON());
      }
    }

    await this.deps.contractRepo.update(contract);

    if (this.deps.domainEventMediator) {
      await this.deps.domainEventMediator.publish(contract);
      await this.deps.domainEventMediator.publishIntegrationEvents(contract);
      contract.clearEvents();
    }

    return ContractOutputMapper.toOutput(contract);
  }

  /**
   * O lado pelo qual o ator assina, derivado das identidades do token.
   *
   * Quando o ator é as duas coisas (o músico que também é dono do bar —
   * multi-role existe desde o 4E.14), o lado do CONTRATADO vence: é o lado que
   * tem obrigação de fazer, e assinar por ele é o ato mais oneroso dos dois.
   * Admin sem vínculo não assina por ninguém.
   */

  private async renderCertificate(contract: Contract): Promise<string> {
    const rendered = await this.deps.renderer.renderSignatureCertificate({
      template_version: contract.template_version,
      template_title: "Contrato de Prestação de Serviços Artísticos Musicais",
      contractor: contract.contractor.toJSON(),
      contracted: contract.contracted.toJSON(),
      variables: contract.variables.toJSON(),
      clauses: contract.clauses.map((clause) => clause.toJSON()),
      content_hash: contract.content_hash,
      verification_code: contract.verification_code,
      verification_url: contract.variables.url_verificacao,
      issued_at: contract.issued_at,
      signatures: contract.signatures.map((signature) => signature.toJSON()),
      signed_at: contract.signed_at ?? new Date(),
    });

    const key = `contracts/${contract.establishment_id.id}/${contract.booking_id.id}/${contract.verification_code}/certificado-r${contract.revision}.${rendered.file_extension}`;

    await this.deps.storage.putObject({
      object_key: key,
      data: rendered.data,
      content_type: rendered.content_type,
    });

    return key;
  }
}
