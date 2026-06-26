import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Repertoire, RepertoireId } from "../../../domain/repertoire.aggregate";
import {
  IRepertoireRepository,
  RepertoireFilter,
  RepertoireSearchParams,
  RepertoireSearchResult,
} from "../../../domain/repertoire.repository";

export class RepertoireInMemoryRepository
  extends InMemorySearchableRepository<Repertoire, RepertoireId, RepertoireFilter>
  implements IRepertoireRepository
{
  sortableFields: string[] = ["name", "created_at"];

  async findByMusicianId(musician_id: string): Promise<Repertoire[]> {
    return this.items.filter((r) => r.musician_id === musician_id);
  }

  async countByMusicianId(musician_id: string): Promise<number> {
    return this.items.filter((r) => r.musician_id === musician_id).length;
  }

  async findByShareToken(token: string): Promise<Repertoire | null> {
    return this.items.find((r) => r.share_token === token) ?? null;
  }

  async findSharedWithMusician(musician_id: string): Promise<Repertoire[]> {
    return this.items.filter((r) =>
      r.invitees.some((i) => i.musician_id === musician_id),
    );
  }

  async search(props: RepertoireSearchParams): Promise<RepertoireSearchResult> {
    const result = await super.search(props);
    return new RepertoireSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: Repertoire[],
    filter: RepertoireFilter | null,
  ): Promise<Repertoire[]> {
    if (!filter) return items;
    return items.filter((r) => {
      const byMusician = filter.musician_id ? r.musician_id === filter.musician_id : true;
      const byName = filter.name
        ? r.name.toLowerCase().includes(filter.name.toLowerCase())
        : true;
      return byMusician && byName;
    });
  }

  protected applySort(
    items: Repertoire[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ): Repertoire[] {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }

  getEntity(): new (...args: any[]) => Repertoire {
    return Repertoire;
  }
}
