import { ForbiddenException } from "@nestjs/common";

import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import {
  ContractSearchParams,
  IContractRepository,
} from "../../../domain/contract.repository";
import { ContractStatus } from "../../../domain/contract-types";
import {
  ContractOutput,
  ContractOutputMapper,
} from "../common/contract-output";

export type ListContractsInput = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  status?: ContractStatus | null;
  booking_id?: string | null;
  /** Todas as identidades do token: `sub` + `establishment_ids` + `band_ids`. */
  requesting_participant_ids?: string[];
  is_admin?: boolean;
};

export type ListContractsOutput = PaginationOutput<ContractOutput>;

/**
 * Caixa de contratos das duas personas.
 *
 * 🔴 **O escopo vem do token, nunca da query.** `participant_ids` casa em OR
 * contra os três lados possíveis, e filtros de query apenas refinam dentro
 * desse escopo — pedir o `establishment_id` de outro devolve zero.
 *
 * **Fail-closed:** ator identificado mas sem nenhuma identidade utilizável
 * recebe 403, e não uma lista sem filtro. Lista vazia de identidades jamais
 * pode virar "sem escopo" — isso devolveria os contratos de todos os usuários,
 * que é o vazamento já ocorrido em `repertoire`, `transaction` e
 * `musician-wallet`. Mesma regra do `ListBookings` (Bloco 9.2).
 */
export class ListContractsUseCase implements IUseCase<
  ListContractsInput,
  ListContractsOutput
> {
  constructor(private readonly contractRepo: IContractRepository) {}

  async execute(input: ListContractsInput): Promise<ListContractsOutput> {
    const participantIds = (input.requesting_participant_ids ?? []).filter(
      Boolean,
    );

    if (!input.is_admin && participantIds.length === 0) {
      throw new ForbiddenException(
        "Não foi possível identificar em nome de quem listar os contratos.",
      );
    }

    const params = ContractSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.booking_id ? { booking_id: input.booking_id } : {}),
        // Admin não é restringido; qualquer outro ator é sempre escopado.
        ...(input.is_admin ? {} : { participant_ids: participantIds }),
      },
    });

    const result = await this.contractRepo.search(params);

    return PaginationOutputMapper.toOutput(
      result.items.map((contract) => ContractOutputMapper.toOutput(contract)),
      result,
    );
  }
}
