import { assertNegotiationViewer } from "../../../../scheduling/application/use-cases/common/negotiation-actor";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Contract, ContractId } from "../../../domain/contract.aggregate";
import { IContractRepository } from "../../../domain/contract.repository";
import {
  ContractOutput,
  ContractOutputMapper,
} from "../common/contract-output";

export type GetContractInput = {
  contract_id: string;
  requesting_participant_ids?: string[];
  is_admin?: boolean;
};

/**
 * Leitura de um contrato por quem é parte.
 *
 * Usa `assertNegotiationViewer`, não `assertNegotiationParticipant`: **ver não
 * é decidir**. Todo integrante de banda com o claim `band_ids` precisa ler o
 * contrato do show que vai tocar; exigir liderança aqui esconderia o próprio
 * contrato dos músicos. Assinar continua exigindo liderança — é lá que a
 * decisão acontece. Mesma distinção de `GetBooking` no Bloco 9.2.
 */
export class GetContractUseCase implements IUseCase<
  GetContractInput,
  ContractOutput
> {
  constructor(private readonly contractRepo: IContractRepository) {}

  async execute(input: GetContractInput): Promise<ContractOutput> {
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
      "este contrato",
    );

    return ContractOutputMapper.toOutput(contract);
  }
}
