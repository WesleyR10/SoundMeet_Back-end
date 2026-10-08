import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  AudienceSpotifyLink,
  AudienceSpotifyLinkId,
} from "../../../domain/audience-spotify-link.aggregate";
import {
  AudienceSpotifyLinkFilter,
  AudienceSpotifyLinkSearchParams,
  AudienceSpotifyLinkSearchResult,
  IAudienceSpotifyLinkRepository,
} from "../../../domain/audience-spotify-link.repository";

export class AudienceSpotifyLinkInMemoryRepository
  extends InMemorySearchableRepository<
    AudienceSpotifyLink,
    AudienceSpotifyLinkId,
    AudienceSpotifyLinkFilter
  >
  implements IAudienceSpotifyLinkRepository
{
  sortableFields: string[] = ["created_at", "expires_at"];

  getEntity(): new (...args: any[]) => AudienceSpotifyLink {
    return AudienceSpotifyLink;
  }

  async search(
    props: AudienceSpotifyLinkSearchParams,
  ): Promise<AudienceSpotifyLinkSearchResult> {
    const result = await super.search(props);
    return new AudienceSpotifyLinkSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  async findByAudienceId(
    audienceId: string,
  ): Promise<AudienceSpotifyLink | null> {
    return this.items.find((i) => i.audience_id.id === audienceId) ?? null;
  }

  async findExpiring(
    before: Date,
    limit: number,
  ): Promise<AudienceSpotifyLink[]> {
    return this.items
      .filter((i) => i.expires_at.getTime() <= before.getTime())
      .sort((a, b) => a.expires_at.getTime() - b.expires_at.getTime())
      .slice(0, limit);
  }

  async deleteByAudienceId(audienceId: string): Promise<void> {
    const index = this.items.findIndex((i) => i.audience_id.id === audienceId);
    if (index >= 0) this.items.splice(index, 1);
  }

  protected async applyFilter(
    items: AudienceSpotifyLink[],
    filter: AudienceSpotifyLinkFilter | null,
  ): Promise<AudienceSpotifyLink[]> {
    if (!filter) return items;

    return items.filter((i) =>
      filter.audience_id ? i.audience_id.id === filter.audience_id : true,
    );
  }

  protected applySort(
    items: AudienceSpotifyLink[],
    sort: string | null,
    sort_dir: "asc" | "desc" | null,
  ): AudienceSpotifyLink[] {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }
}
