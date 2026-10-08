import { Readable } from "node:stream";

import { assertNegotiationViewer } from "../../../../scheduling/application/use-cases/common/negotiation-actor";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Contract, ContractId } from "../../../domain/contract.aggregate";
import { IContractRepository } from "../../../domain/contract.repository";
import { IContractStorage } from "../../ports/contract-storage.interface";

export type GetContractDocumentInput = {
  contract_id: string;
  /** `contract` = o instrumento; `certificate` = o Anexo II. */
  kind?: "contract" | "certificate";
  requesting_participant_ids?: string[];
  is_admin?: boolean;
};

export type GetContractDocumentOutput = {
  data: Readable;
  content_type: string;
  content_length: number | null;
  /** Nome sugerido no `Content-Disposition`. Sem PII. */
  filename: string;
};

/**
 * Download autorizado do documento.
 *
 * É a razão de `IContractStorage` não ter `getPublicUrl`: o arquivo tem CPF,
 * CNPJ, endereço e valor, e num bucket público o que o protegeria seria a
 * imprevisibilidade da chave — segurança por obscuridade. Aqui a autorização
 * acontece antes de qualquer byte sair, e o stream passa pela aplicação.
 */
export class GetContractDocumentUseCase implements IUseCase<
  GetContractDocumentInput,
  GetContractDocumentOutput
> {
  constructor(
    private readonly contractRepo: IContractRepository,
    private readonly storage: IContractStorage,
  ) {}

  async execute(
    input: GetContractDocumentInput,
  ): Promise<GetContractDocumentOutput> {
    const contract = await this.contractRepo.findById(
      new ContractId(input.contract_id),
    );

    if (!contract) {
      throw new NotFoundError(input.contract_id, Contract);
    }

    assertNegotiationViewer(
      {
        requesting_participant_ids: input.requesting_participant_ids,
        is_admin: input.is_admin,
      },
      {
        establishment_id: contract.establishment_id.id,
        musician_id: contract.musician_id?.id ?? null,
        band_id: contract.band_id?.id ?? null,
      },
      "o documento deste contrato",
    );

    const kind = input.kind ?? "contract";
    const key =
      kind === "certificate" ? contract.certificate_key : contract.document_key;

    if (!key) {
      throw new NotFoundError(`${input.contract_id}:${kind}`, Contract);
    }

    const object = await this.storage.getObject({ object_key: key });

    /*
     * Chave gravada mas objeto ausente é 404, não 500: bucket trocado ou objeto
     * expirado é problema operacional, e mandar o suporte investigar um erro de
     * aplicação seria mandá-lo para o lado errado.
     */
    if (!object) {
      throw new NotFoundError(`${input.contract_id}:${kind}`, Contract);
    }

    const extension = key.split(".").pop() ?? "pdf";
    const prefix = kind === "certificate" ? "certificado" : "contrato";

    return {
      data: object.data,
      content_type: object.content_type,
      content_length: object.content_length,
      filename: `${prefix}-${contract.verification_code}.${extension}`,
    };
  }
}
