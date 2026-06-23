import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  RequestVote,
  RequestVoteId,
} from "../../../domain/request-vote.aggregate";
import {
  IRequestVoteRepository,
  RequestVoteFilter,
  RequestVoteSearchParams,
  RequestVoteSearchResult,
} from "../../../domain/request-vote.repository";
import { RequestVoteType } from "../../../domain/value-objects/request-vote-type.vo";

export class RequestVoteInMemoryRepository
  extends InMemorySearchableRepository<
    RequestVote,
    RequestVoteId,
    RequestVoteFilter
  >
  implements IRequestVoteRepository
{
  sortableFields: string[] = ["created_at", "vote_type"];

  async search(
    props: RequestVoteSearchParams,
  ): Promise<RequestVoteSearchResult> {
    const result = await super.search(props);
    return new RequestVoteSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: RequestVote[],
    filter: RequestVoteFilter | null,
  ): Promise<RequestVote[]> {
    if (!filter) return items;

    return items.filter((item) => {
      let matches = true;
      if (filter.request_id) {
        matches = matches && item.request_id.id === filter.request_id;
      }
      if (filter.audience_id) {
        matches = matches && item.audience_id.id === filter.audience_id;
      }
      if (filter.vote_type) {
        matches = matches && item.vote_type === filter.vote_type;
      }
      return matches;
    });
  }

  async findByRequestId(request_id: string): Promise<RequestVote[]> {
    return this.items.filter((item) => item.request_id.id === request_id);
  }

  async findByRequestAndAudience(
    request_id: string,
    audience_id: string,
  ): Promise<RequestVote | null> {
    return (
      this.items.find(
        (item) =>
          item.request_id.id === request_id &&
          item.audience_id.id === audience_id,
      ) ?? null
    );
  }

  async countUpVotesByRequestId(request_id: string): Promise<number> {
    return this.items.filter(
      (item) =>
        item.request_id.id === request_id &&
        item.vote_type === RequestVoteType.UP,
    ).length;
  }

  getEntity(): new (...args: any[]) => RequestVote {
    return RequestVote;
  }

  protected applySort(
    items: RequestVote[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }
}
