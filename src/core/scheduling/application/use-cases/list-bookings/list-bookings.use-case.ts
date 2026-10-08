import { ForbiddenException } from "@nestjs/common";

import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  BookingSearchParams,
  IBookingRepository,
} from "../../../domain/booking.repository";
import { BookingOutput, BookingOutputMapper } from "../common/booking-output";

export type ListBookingsInput = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: "asc" | "desc" | null;
  establishment_id?: string | null;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  status?: string | null;
  start_at_gte?: Date | null;
  start_at_lte?: Date | null;
  /**
   * TODAS as identidades do usuário autenticado (`sub` + claims
   * `establishment_ids`/`band_ids`), resolvidas do JWT no controller.
   *
   * Quando presente e o ator não é admin, **restringe** o resultado ao que ele
   * participa — em AND com os filtros pedidos pelo cliente. Os filtros acima
   * apenas refinam dentro desse escopo; nunca o ampliam.
   */
  requesting_participant_ids?: string[] | null;
  is_admin?: boolean;
};

export type ListBookingsOutput = PaginationOutput<BookingOutput>;

/**
 * Listagem de reservas (Bloco 9.2).
 *
 * Antes disto o domínio tinha propose/confirm/cancel e **nenhuma leitura**: o
 * estabelecimento propunha uma reserva e nunca mais a via. É o que destrava o
 * funil de contratação do dashboard web e o card "Próximo Show" do mobile.
 *
 * O escopo NÃO vem de query param — vem do token. Aceitar `establishment_id`
 * como fonte de autorização deixaria qualquer autenticado ler a agenda alheia
 * trocando um id na URL.
 */
export class ListBookingsUseCase implements IUseCase<
  ListBookingsInput,
  ListBookingsOutput
> {
  constructor(private readonly bookingRepo: IBookingRepository) {}

  async execute(input: ListBookingsInput): Promise<ListBookingsOutput> {
    const params = BookingSearchParams.create({
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
        start_at_gte: input.start_at_gte ?? null,
        start_at_lte: input.start_at_lte ?? null,
        participant_ids: resolveScope(input),
      },
    });

    const result = await this.bookingRepo.search(params);

    return PaginationOutputMapper.toOutput(
      result.items.map(BookingOutputMapper.toOutput),
      result,
    );
  }
}

/**
 * `null` = sem restrição (admin, ou chamada interna sem ator).
 * Array = restringe. Nunca devolve `[]` silenciosamente: um ator identificado
 * mas sem nenhuma identidade utilizável é fiação quebrada, e falhar visível é
 * melhor que devolver lista vazia (que pareceria "você não tem reservas").
 */
function resolveScope(input: ListBookingsInput): string[] | null {
  if (input.is_admin) {
    return null;
  }

  if (input.requesting_participant_ids == null) {
    return null;
  }

  const ids = input.requesting_participant_ids.filter(Boolean);

  if (ids.length === 0) {
    throw new ForbiddenException(
      "Não foi possível determinar sua identidade para listar reservas.",
    );
  }

  return ids;
}
