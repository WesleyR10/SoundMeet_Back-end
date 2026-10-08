import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { BookingStatusEnum } from "../../shared/domain/value-objects/booking-status.vo";
import { Booking, BookingId } from "./booking.aggregate";

export type BookingFilter = {
  establishment_id?: string | null;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  status?: BookingStatusEnum | string | null;
  start_at_gte?: Date | null;
  start_at_lte?: Date | null;
  end_at_gte?: Date | null;
  end_at_lte?: Date | null;
  /**
   * Escopo de leitura (Bloco 9.2): TODAS as identidades do usuário — `sub` +
   * claims `establishment_ids`/`band_ids`. Casa em OR contra
   * `establishment_id`/`musician_id`/`band_id` do booking, porque o lado pelo
   * qual a pessoa participa depende do papel: um id só não dá conta.
   *
   * Combina em AND com os demais filtros: `status=confirmed` + escopo devolve
   * os confirmados **do usuário**, nunca os de todo mundo.
   *
   * ⚠️ Array vazio significa "nenhuma identidade" e **tem** que resultar em
   * zero linhas. Descartá-lo aqui (ou nos repositórios) devolveria a agenda de
   * todos os usuários — é exatamente o vazamento que já aconteceu em
   * `repertoire`/`transaction`/`musician-wallet`.
   */
  participant_ids?: string[] | null;
};

export class BookingSearchParams extends DefaultSearchParams<BookingFilter> {
  private constructor(props: SearchParamsConstructorProps<BookingFilter> = {}) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<BookingFilter> = {}) {
    return new BookingSearchParams(props);
  }

  get filter(): BookingFilter | null {
    return this._filter;
  }

  protected set filter(value: BookingFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value &&
        _value.establishment_id && {
          establishment_id: `${_value.establishment_id}`,
        }),
      ...(_value &&
        _value.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value && _value.band_id && { band_id: `${_value.band_id}` }),
      ...(_value && _value.event_id && { event_id: `${_value.event_id}` }),
      ...(_value && _value.status && { status: `${_value.status}` }),
      ...(_value &&
        _value.start_at_gte && { start_at_gte: _value.start_at_gte }),
      ...(_value &&
        _value.start_at_lte && { start_at_lte: _value.start_at_lte }),
      ...(_value && _value.end_at_gte && { end_at_gte: _value.end_at_gte }),
      ...(_value && _value.end_at_lte && { end_at_lte: _value.end_at_lte }),
      // Array — NÃO pode passar pela coerção `${...}` usada nos escalares
      // acima, que o transformaria em "id-a,id-b" e nunca casaria com nada.
      // `[]` é preservado de propósito (ver comentário em BookingFilter).
      ...(_value &&
        Array.isArray(_value.participant_ids) && {
          participant_ids: _value.participant_ids.filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
        }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : (filter as any);
  }
}

export class BookingSearchResult extends DefaultSearchResult<Booking> {}

export interface IBookingRepository extends ISearchableRepository<
  Booking,
  BookingId,
  BookingFilter,
  BookingSearchParams,
  BookingSearchResult
> {
  findPendingExpired(now: Date): Promise<Booking[]>;

  expirePendingExpired(now: Date): Promise<number>;

  findConfirmedPastCompletionWindow(threshold: Date): Promise<Booking[]>;

  updateWithStatus(
    entity: Booking,
    expected_statuses: BookingStatusEnum[],
  ): Promise<boolean>;

  findConfirmedInRangeByMusician(
    musician_id: string,
    start: Date,
    end: Date,
  ): Promise<Booking[]>;

  findConfirmedInRangeByBand(
    band_id: string,
    start: Date,
    end: Date,
  ): Promise<Booking[]>;

  countConfirmedOnDayByMusician(
    musician_id: string,
    day: Date,
    timezone?: string,
  ): Promise<number>;

  countConfirmedOnDayByBand(
    band_id: string,
    day: Date,
    timezone?: string,
  ): Promise<number>;
}
