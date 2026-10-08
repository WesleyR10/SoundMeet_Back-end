import { ForbiddenException } from "@nestjs/common";

import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  IInquiryRepository,
  InquirySearchParams,
} from "../../../domain/inquiry.repository";
import { InquiryOutput, InquiryOutputMapper } from "../common/inquiry-output";

export type ListInquiriesInput = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: "asc" | "desc" | null;
  establishment_id?: string | null;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  status?: string | null;
  created_at_gte?: Date | null;
  created_at_lte?: Date | null;
  /** Ver `ListBookingsInput.requesting_participant_ids`. */
  requesting_participant_ids?: string[] | null;
  is_admin?: boolean;
};

export type ListInquiriesOutput = PaginationOutput<InquiryOutput>;

/**
 * Caixa de entrada de propostas (Bloco 9.2), dos dois lados: o estabelecimento
 * acompanha o que enviou, o músico vê o que recebeu. Mesmo modelo de escopo do
 * `ListBookingsUseCase` — a identidade vem do token, nunca da query.
 */
export class ListInquiriesUseCase implements IUseCase<
  ListInquiriesInput,
  ListInquiriesOutput
> {
  constructor(private readonly inquiryRepo: IInquiryRepository) {}

  async execute(input: ListInquiriesInput): Promise<ListInquiriesOutput> {
    const params = InquirySearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        establishment_id: input.establishment_id ?? null,
        musician_id: input.musician_id ?? null,
        band_id: input.band_id ?? null,
        event_id: input.event_id ?? null,
        status: input.status ?? null,
        created_at_gte: input.created_at_gte ?? null,
        created_at_lte: input.created_at_lte ?? null,
        participant_ids: resolveScope(input),
      },
    });

    const result = await this.inquiryRepo.search(params);

    return PaginationOutputMapper.toOutput(
      result.items.map(InquiryOutputMapper.toOutput),
      result,
    );
  }
}

function resolveScope(input: ListInquiriesInput): string[] | null {
  if (input.is_admin) {
    return null;
  }

  if (input.requesting_participant_ids == null) {
    return null;
  }

  const ids = input.requesting_participant_ids.filter(Boolean);

  if (ids.length === 0) {
    throw new ForbiddenException(
      "Não foi possível determinar sua identidade para listar propostas.",
    );
  }

  return ids;
}
