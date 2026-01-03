import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Inquiry, InquiryId } from "../../../domain/inquiry.aggregate";
import {
  IInquiryRepository,
  InquiryFilter,
  InquirySearchParams,
  InquirySearchResult,
} from "../../../domain/inquiry.repository";

export class InquiryInMemoryRepository
  extends InMemorySearchableRepository<Inquiry, InquiryId, InquiryFilter>
  implements IInquiryRepository
{
  sortableFields: string[] = ["created_at", "updated_at", "status"];

  async search(props: InquirySearchParams): Promise<InquirySearchResult> {
    const result = await super.search(props);
    return new InquirySearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  async findOpenExpired(now: Date): Promise<Inquiry[]> {
    const nowMs = now.getTime();
    return this.items.filter((inquiry) => {
      if (!inquiry.status.isOpen()) return false;
      if (!inquiry.expires_at) return false;
      return inquiry.expires_at.getTime() <= nowMs;
    });
  }

  protected async applyFilter(
    items: Inquiry[],
    filter: InquiryFilter | null,
  ): Promise<Inquiry[]> {
    if (!filter) {
      return items;
    }

    return items.filter((inquiry) => {
      let matches = true;

      if (filter.establishment_id) {
        matches =
          matches && inquiry.establishment_id.id === filter.establishment_id;
      }

      if (filter.musician_id) {
        matches = matches && inquiry.musician_id?.id === filter.musician_id;
      }

      if (filter.band_id) {
        matches = matches && inquiry.band_id?.id === filter.band_id;
      }

      if (filter.event_id) {
        matches = matches && inquiry.event_id?.id === filter.event_id;
      }

      if (filter.status) {
        matches = matches && inquiry.status.value === filter.status;
      }

      if (filter.created_at_gte) {
        matches = matches && inquiry.created_at >= filter.created_at_gte;
      }

      if (filter.created_at_lte) {
        matches = matches && inquiry.created_at <= filter.created_at_lte;
      }

      return matches;
    });
  }

  getEntity(): new (...args: any[]) => Inquiry {
    return Inquiry;
  }

  protected applySort(
    items: Inquiry[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir, (sort, item) => {
          if (sort === "status") {
            return item.status.value;
          }
          if (sort === "created_at") {
            return item.created_at.getTime();
          }
          if (sort === "updated_at") {
            return item.updated_at.getTime();
          }
          return item[sort];
        })
      : super.applySort(items, "created_at", "desc");
  }
}
