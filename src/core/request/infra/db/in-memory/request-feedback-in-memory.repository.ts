import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  RequestFeedback,
  RequestFeedbackId,
} from "../../../domain/request-feedback.aggregate";
import {
  IRequestFeedbackRepository,
  RequestFeedbackFilter,
  RequestFeedbackSearchParams,
  RequestFeedbackSearchResult,
} from "../../../domain/request-feedback.repository";

export class RequestFeedbackInMemoryRepository
  extends InMemorySearchableRepository<
    RequestFeedback,
    RequestFeedbackId,
    RequestFeedbackFilter
  >
  implements IRequestFeedbackRepository
{
  sortableFields: string[] = ["created_at", "rating"];

  async search(
    props: RequestFeedbackSearchParams,
  ): Promise<RequestFeedbackSearchResult> {
    const result = await super.search(props);
    return new RequestFeedbackSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: RequestFeedback[],
    filter: RequestFeedbackFilter | null,
  ): Promise<RequestFeedback[]> {
    if (!filter) {
      return items;
    }

    return items.filter((item) => {
      let matches = true;

      if (filter.request_id && item.request_id.id !== filter.request_id) {
        matches = false;
      }

      if (
        filter.rating !== null &&
        filter.rating !== undefined &&
        item.rating !== filter.rating
      ) {
        matches = false;
      }

      if (
        filter.min_rating !== null &&
        filter.min_rating !== undefined &&
        item.rating < filter.min_rating
      ) {
        matches = false;
      }

      if (
        filter.max_rating !== null &&
        filter.max_rating !== undefined &&
        item.rating > filter.max_rating
      ) {
        matches = false;
      }

      if (filter.created_after && item.created_at < filter.created_after) {
        matches = false;
      }

      if (filter.created_before && item.created_at > filter.created_before) {
        matches = false;
      }

      return matches;
    });
  }

  getEntity(): new (...args: any[]) => RequestFeedback {
    return RequestFeedback;
  }

  protected applySort(
    items: RequestFeedback[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }

  async findByRequestId(request_id: string): Promise<RequestFeedback | null> {
    const item = this.items.find((item) => item.request_id.id === request_id);
    return item ?? null;
  }
}
