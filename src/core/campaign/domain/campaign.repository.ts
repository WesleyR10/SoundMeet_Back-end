import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Campaign, CampaignId } from "./campaign.aggregate";

export type CampaignFilter = {
  establishment_id?: string | null;
  status?: string | null;
  title?: string | null;
};

export class CampaignSearchParams extends DefaultSearchParams<CampaignFilter> {
  private constructor(
    props: SearchParamsConstructorProps<CampaignFilter> = {},
  ) {
    super(props);
  }

  static create(
    props: SearchParamsConstructorProps<CampaignFilter> = {},
  ): CampaignSearchParams {
    return new CampaignSearchParams(props);
  }

  // A base SearchParams.filter serializa qualquer valor não-string via
  // template literal (`${value}`), o que reduz um filtro objeto a
  // "[object Object]" e faz applyFilter() nunca filtrar nada — bug real
  // encontrado jul/2026 ao corrigir o scoping de ownership de GET
  // /campaigns. Mesmo padrão de override já usado em
  // MusicianSearchParams/musician.repository.ts.
  get filter(): CampaignFilter | null {
    return this._filter;
  }

  protected set filter(value: CampaignFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value?.establishment_id && {
        establishment_id: `${_value.establishment_id}`,
      }),
      ...(_value?.status && { status: `${_value.status}` }),
      ...(_value?.title && { title: `${_value.title}` }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class CampaignSearchResult extends DefaultSearchResult<Campaign> {}

export interface ICampaignRepository
  extends ISearchableRepository<
    Campaign,
    CampaignId,
    CampaignFilter,
    CampaignSearchParams,
    CampaignSearchResult
  > {
  findByEstablishmentId(establishment_id: string): Promise<Campaign[]>;
}
