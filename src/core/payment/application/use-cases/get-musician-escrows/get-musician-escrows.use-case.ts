import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { SearchInput } from "../../../../shared/application/search-input";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  BookingEscrowFilter,
  BookingEscrowSearchParams,
  BookingEscrowSearchResult,
  IBookingEscrowRepository,
} from "../../../domain/repositories/booking-escrow.repository";
import {
  BookingEscrowOutput,
  BookingEscrowOutputMapper,
} from "../common/booking-escrow-output";

export type GetMusicianEscrowsInput = SearchInput<BookingEscrowFilter> & {
  musician_id: string;
};

export type GetMusicianEscrowsOutput = PaginationOutput<BookingEscrowOutput>;

/**
 * As custódias de cachê de um músico — o extrato de "o que está retido".
 *
 * Somente leitura de propósito: nenhuma ação de custódia é iniciada por HTTP.
 * Quem retém é o webhook do provedor e quem libera é o job — as duas únicas
 * fontes que sabem o que de fato aconteceu com o dinheiro. Uma rota de
 * "liberar agora" exposta ao músico transformaria a salvaguarda de check-in
 * numa formalidade.
 */
export class GetMusicianEscrowsUseCase implements IUseCase<
  GetMusicianEscrowsInput,
  GetMusicianEscrowsOutput
> {
  constructor(private readonly escrowRepository: IBookingEscrowRepository) {}

  async execute(
    input: GetMusicianEscrowsInput,
  ): Promise<GetMusicianEscrowsOutput> {
    const searchParams = new BookingEscrowSearchParams({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        ...(input.filter || {}),
        /*
         * 🔴 `musician_id` DEPOIS do spread, nunca antes.
         *
         * O filtro da query é refino dentro do escopo, jamais o escopo em si.
         * Espalhado por último, um `?filter[musician_id]=<alheio>` sobrescreveria
         * o dono resolvido pela rota e devolveria a custódia de outra pessoa —
         * o ownership guard autoriza o dono da URL, mas não escopa a consulta.
         */
        musician_id: input.musician_id,
      },
    });

    const searchResult = await this.escrowRepository.search(searchParams);

    return this.toOutput(searchResult);
  }

  private toOutput(
    searchResult: BookingEscrowSearchResult,
  ): GetMusicianEscrowsOutput {
    const items = searchResult.items.map((escrow) =>
      BookingEscrowOutputMapper.toOutput(escrow),
    );
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}
