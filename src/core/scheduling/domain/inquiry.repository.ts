import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { InquiryStatusEnum } from "../../shared/domain/value-objects/inquiry-status.vo";
import { Inquiry, InquiryId } from "./inquiry.aggregate";

export type InquiryFilter = {
  establishment_id?: string | null;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  status?: InquiryStatusEnum | string | null;
  created_at_gte?: Date | null;
  created_at_lte?: Date | null;
  /**
   * Escopo de leitura (Bloco 9.2) — mesma semântica de
   * `BookingFilter.participant_ids`: OR contra
   * `establishment_id`/`musician_id`/`band_id`, AND com os demais filtros,
   * e array vazio **tem** que devolver zero linhas.
   */
  participant_ids?: string[] | null;
};

export class InquirySearchParams extends DefaultSearchParams<InquiryFilter> {
  private constructor(props: SearchParamsConstructorProps<InquiryFilter> = {}) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<InquiryFilter> = {}) {
    return new InquirySearchParams(props);
  }

  get filter(): InquiryFilter | null {
    return this._filter;
  }

  protected set filter(value: InquiryFilter | null) {
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
        _value.created_at_gte && { created_at_gte: _value.created_at_gte }),
      ...(_value &&
        _value.created_at_lte && { created_at_lte: _value.created_at_lte }),
      // Array — fora da coerção de string dos escalares acima. Ver
      // BookingSearchParams para o motivo detalhado.
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

export class InquirySearchResult extends DefaultSearchResult<Inquiry> {}

export interface IInquiryRepository extends ISearchableRepository<
  Inquiry,
  InquiryId,
  InquiryFilter,
  InquirySearchParams,
  InquirySearchResult
> {
  findOpenExpired(now: Date): Promise<Inquiry[]>;
}
