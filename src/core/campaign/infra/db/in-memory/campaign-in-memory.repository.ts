import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Campaign, CampaignId } from "../../../domain/campaign.aggregate";
import {
  CampaignFilter,
  CampaignSearchParams,
  CampaignSearchResult,
  ICampaignRepository,
} from "../../../domain/campaign.repository";

export class CampaignInMemoryRepository
  extends InMemorySearchableRepository<
    Campaign,
    CampaignId,
    CampaignFilter
  >
  implements ICampaignRepository
{
  sortableFields: string[] = ["title", "start_date", "created_at"];

  async findByEstablishmentId(establishment_id: string): Promise<Campaign[]> {
    return this.items.filter((c) => c.establishment_id === establishment_id);
  }

  async search(props: CampaignSearchParams): Promise<CampaignSearchResult> {
    const result = await super.search(props);
    return new CampaignSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: Campaign[],
    filter: CampaignFilter | null,
  ): Promise<Campaign[]> {
    if (!filter) return items;
    return items.filter((c) => {
      const byEstablishment = filter.establishment_id
        ? c.establishment_id === filter.establishment_id
        : true;
      const byStatus = filter.status ? c.status === filter.status : true;
      return byEstablishment && byStatus;
    });
  }

  protected applySort(
    items: Campaign[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ): Campaign[] {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }

  getEntity(): new (...args: any[]) => Campaign {
    return Campaign;
  }
}
