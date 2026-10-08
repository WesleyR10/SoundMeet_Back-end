import { ISearchableRepository } from "../../../shared/domain/repository/repository-interface";
import { SearchParams } from "../../../shared/domain/repository/search-params";
import { SearchResult } from "../../../shared/domain/repository/search-result";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { BookingEscrow, BookingEscrowId } from "../booking-escrow.aggregate";
import { BookingEscrowStatus } from "../booking-escrow-enums";

export type BookingEscrowFilter = {
  musician_id?: string;
  booking_id?: string;
  status?: BookingEscrowStatus;
};

export class BookingEscrowSearchParams extends SearchParams<BookingEscrowFilter> {
  get filter(): BookingEscrowFilter | null {
    return this._filter;
  }

  /**
   * Override obrigatório — regra geral do projeto, e aqui com a consequência
   * mais séria de todas.
   *
   * O setter da classe base coage o filtro-objeto a `"[object Object]"`
   * (herança do FC3, onde `Filter` é busca livre). O repositório receberia uma
   * string truthy, leria `filter.musician_id` como `undefined`, montaria
   * `where: {}` e devolveria **a custódia de todos os músicos** — valor de
   * cachê, comissão e referência da cobrança no provedor. Já aconteceu de
   * verdade em `repertoire` (vazamento ativo) e latente em `transaction` e
   * `musician-wallet`.
   */
  protected set filter(value: BookingEscrowFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value?.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value?.booking_id && { booking_id: `${_value.booking_id}` }),
      ...(_value?.status && { status: _value.status }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class BookingEscrowSearchResult extends SearchResult<BookingEscrow> {}

export interface IBookingEscrowRepository extends ISearchableRepository<
  BookingEscrow,
  BookingEscrowId,
  BookingEscrowFilter,
  BookingEscrowSearchParams,
  BookingEscrowSearchResult
> {
  findByBookingId(bookingId: string): Promise<BookingEscrow | null>;
  findByExternalId(externalId: string): Promise<BookingEscrow | null>;
  /**
   * Custódias retidas cujo prazo de contestação já venceu — a varredura do
   * `EscrowReleaseJob`.
   *
   * Devolve só `held`: `disputed` espera mediação humana e liberar
   * automaticamente uma contestação em aberto seria decidir a disputa a favor
   * de um lado por omissão.
   */
  findReleasable(before: Date, limit: number): Promise<BookingEscrow[]>;
}
