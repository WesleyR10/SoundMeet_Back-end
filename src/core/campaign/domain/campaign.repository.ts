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
