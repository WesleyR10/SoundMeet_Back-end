import { IBandRepository } from "../../../../musician/domain/band.repository";
import { assertNegotiationParticipant } from "../../../../scheduling/application/use-cases/common/negotiation-actor";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Contract, ContractId } from "../../../domain/contract.aggregate";
import { IContractRepository } from "../../../domain/contract.repository";
import { ContractPartyRole } from "../../../domain/contract-types";
import { IContractChallengeNotifier } from "../../ports/contract-challenge-notifier.port";
import { IContractSignatureChallenge } from "../../ports/contract-signature-challenge.port";
import { resolveSigningRole } from "../common/resolve-signing-role";
import { RequestSignatureChallengeInput } from "./request-signature-challenge.input";

/**
 * Emite o código de uso único que a parte precisa informar para assinar.
 *
 * ## O que este use-case NÃO devolve
 *
 * 🔴 **O código.** Ele vai para a caixa da parte e mais nada. Devolvê-lo na
 * resposta HTTP anularia o segundo fator: quem já tem o token da conta leria o
 * código na própria resposta, e a medida viraria teatro.
 *
 * O output traz o destino **mascarado** e o vencimento — o suficiente para a
 * interface dizer "enviamos para a…@exemplo.com, válido por 10 minutos" sem
 * revelar o e-mail inteiro a quem porventura tenha tomado a sessão.
 *
 * ## Autorização idêntica à da assinatura
 *
 * Mesmo `assertNegotiationParticipant` e mesmo `resolveSigningRole`. Se a
 * autorização daqui fosse mais frouxa, ela seria a porta: pedir código é o
 * passo anterior a assinar, e um terceiro que consiga emitir já está dentro do
 * fluxo.
 */
export type RequestSignatureChallengeOutput = {
  role: ContractPartyRole;
  /** `a****@exemplo.com` — confirma o destino sem expô-lo. */
  destination_masked: string;
  expires_at: Date;
};

export type RequestSignatureChallengeDeps = {
  contractRepo: IContractRepository;
  challenge: IContractSignatureChallenge;
  notifier: IContractChallengeNotifier;
  bandRepo?: IBandRepository;
};

export class RequestSignatureChallengeUseCase implements IUseCase<
  RequestSignatureChallengeInput,
  RequestSignatureChallengeOutput
> {
  constructor(private readonly deps: RequestSignatureChallengeDeps) {}

  async execute(
    input: RequestSignatureChallengeInput,
  ): Promise<RequestSignatureChallengeOutput> {
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
     * Recusar antes de emitir. Sem isto, um contrato já assinado ou anulado
     * ainda dispararia e-mail com código válido — ruído para o usuário e
     * superfície de tentativa sem nenhum contrato para assinar do outro lado.
     */
    if (contract.signatureOf(role)) {
      throw new EntityValidationError([
        { role: ["Esta parte já assinou o contrato."] },
      ]);
    }
    if (contract.status === "annulled") {
      throw new EntityValidationError([
        { contract_id: ["Contrato anulado não pode ser assinado."] },
      ]);
    }

    const party =
      role === "contractor" ? contract.contractor : contract.contracted;

    const { code, expires_at } = await this.deps.challenge.issue({
      contract_id: contract.contract_id.id,
      role,
      signer_user_id: input.requesting_user_id,
    });

    await this.deps.notifier.sendSignatureChallenge({
      to: party.email,
      party_name: party.display_name || party.legal_name,
      role,
      code,
      expires_at,
      verification_code: contract.verification_code,
    });

    return {
      role,
      destination_masked: maskEmail(party.email),
      expires_at,
    };
  }
}

/**
 * `ana.ribeiro@exemplo.com` → `a**********@exemplo.com`.
 *
 * O domínio fica visível porque é o que permite à parte perceber que o código
 * foi para a conta antiga; a parte local é o que não pode vazar.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return "***";

  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(local.length - 1, 1))}@${domain}`;
}
