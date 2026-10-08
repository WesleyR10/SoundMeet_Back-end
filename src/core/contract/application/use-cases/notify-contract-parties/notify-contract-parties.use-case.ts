import { Readable } from "node:stream";

import { IBandRepository } from "../../../../musician/domain/band.repository";
import { assertNegotiationParticipant } from "../../../../scheduling/application/use-cases/common/negotiation-actor";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Contract, ContractId } from "../../../domain/contract.aggregate";
import { IContractRepository } from "../../../domain/contract.repository";
import { ContractPartyRole } from "../../../domain/contract-types";
import {
  ContractDocumentMoment,
  IContractDocumentNotifier,
} from "../../ports/contract-document-notifier.port";
import { IContractStorage } from "../../ports/contract-storage.interface";
import { resolveSigningRole } from "../common/resolve-signing-role";

/**
 * Envia o contrato às partes, com o PDF anexo e o hash no corpo.
 *
 * ## Nunca interrompe o fluxo que o disparou
 *
 * Este use-case é chamado por handlers de evento — na emissão e quando a
 * segunda assinatura fecha o contrato. O contrato **já está persistido** quando
 * chega aqui, então uma falha de e-mail não pode desfazê-lo nem estourar para
 * cima: o resultado é **relatado**, não lançado.
 *
 * Mas relatar não é engolir. O retorno diz exatamente quem recebeu e quem não
 * recebeu, com o erro — e o handler loga com `contract_id`, papel e momento. É
 * a diferença entre "falhou o envio para alguém" e uma linha acionável.
 *
 * Uma parte falhar não impede a outra: as entregas são independentes, e perder
 * as duas porque o servidor da primeira recusou seria pior.
 */
export type NotifyContractPartiesInput = {
  contract_id: string;
  /** Ausente no reenvio: derivado do status do contrato já carregado. */
  moment?: ContractDocumentMoment;
  /** Reenvio para um lado só. Ausente, envia para os dois. */
  only_role?: ContractPartyRole;
  /**
   * Presente só no reenvio pedido por uma parte.
   *
   * Quando vem, o use-case **autoriza** e **deriva o papel do agregado** — o
   * controller não tem o `Contract` em mãos, só o DTO de saída, e derivar papel
   * a partir de DTO exigiria repetir a regra num lugar onde ela envelheceria.
   */
  requesting_participant_ids?: string[];
  requesting_musician_id?: string;
  is_admin?: boolean;
};

export type NotifyContractPartiesOutput = {
  delivered: ContractPartyRole[];
  failed: { role: ContractPartyRole; reason: string }[];
  /** `false` quando o documento não está no storage — nada foi enviado. */
  document_available: boolean;
};

export type NotifyContractPartiesDeps = {
  contractRepo: IContractRepository;
  storage: IContractStorage;
  notifier: IContractDocumentNotifier;
  verificationBaseUrl: string;
  bandRepo?: IBandRepository;
};

export class NotifyContractPartiesUseCase implements IUseCase<
  NotifyContractPartiesInput,
  NotifyContractPartiesOutput
> {
  constructor(private readonly deps: NotifyContractPartiesDeps) {}

  async execute(
    input: NotifyContractPartiesInput,
  ): Promise<NotifyContractPartiesOutput> {
    const contract = await this.deps.contractRepo.findById(
      new ContractId(input.contract_id),
    );
    if (!contract) {
      throw new NotFoundError(input.contract_id, Contract);
    }

    /*
     * Reenvio pedido por uma parte: autoriza e restringe ao lado dela. Sem o
     * `only_role` derivado aqui, a rota mandaria a cópia da outra parte junto.
     */
    let onlyRole = input.only_role;
    if (input.requesting_participant_ids) {
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
        "receber a cópia deste contrato",
        this.deps.bandRepo,
      );
      onlyRole = resolveSigningRole(contract, input.requesting_participant_ids);
    }

    const moment: ContractDocumentMoment =
      input.moment ?? (contract.status === "signed" ? "signed" : "issued");

    if (!contract.document_key) {
      return { delivered: [], failed: [], document_available: false };
    }

    const object = await this.deps.storage.getObject({
      object_key: contract.document_key,
    });
    if (!object) {
      return { delivered: [], failed: [], document_available: false };
    }

    const content = await toBuffer(object.data);

    const roles: ContractPartyRole[] = onlyRole
      ? [onlyRole]
      : ["contractor", "contracted"];

    const delivered: ContractPartyRole[] = [];
    const failed: { role: ContractPartyRole; reason: string }[] = [];

    for (const role of roles) {
      const party =
        role === "contractor" ? contract.contractor : contract.contracted;
      const counterparty =
        role === "contractor" ? contract.contracted : contract.contractor;

      try {
        await this.deps.notifier.sendContractDocument({
          to: party.email,
          party_name: party.display_name || party.legal_name,
          role,
          moment,
          counterparty_name:
            counterparty.display_name || counterparty.legal_name,
          verification_code: contract.verification_code,
          verification_url: `${this.deps.verificationBaseUrl}/${contract.verification_code}`,
          content_hash: contract.content_hash,
          show_date: contract.variables.data_show,
          local_name: contract.variables.local_nome,
          fee_formatted: contract.variables.cache_formatado,
          document: {
            /*
             * Nome do arquivo com o código de verificação: quem recebe vários
             * contratos precisa distinguir os anexos na caixa de entrada, e o
             * código é o que liga o arquivo à página pública.
             */
            filename: `contrato-${contract.verification_code}.pdf`,
            content,
          },
        });
        delivered.push(role);
      } catch (error) {
        failed.push({
          role,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { delivered, failed, document_available: true };
  }
}

async function toBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
