import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  PersonalChordSheet,
  PersonalChordSheetId,
  type PersonalChordSheetShareScope,
} from "../../../domain/personal-chord-sheet.aggregate";
import {
  IPersonalChordSheetRepository,
  PersonalChordSheetFilter,
  PersonalChordSheetSearchParams,
  PersonalChordSheetSearchResult,
} from "../../../domain/personal-chord-sheet.repository";

export class PersonalChordSheetInMemoryRepository
  extends InMemorySearchableRepository<
    PersonalChordSheet,
    PersonalChordSheetId,
    PersonalChordSheetFilter
  >
  implements IPersonalChordSheetRepository
{
  sortableFields: string[] = ["created_at", "updated_at", "shared_at"];

  async findByMusicianAndMusicLibrary(
    musician_id: string,
    music_library_id: string,
  ): Promise<PersonalChordSheet | null> {
    return (
      this.items.find(
        (s) =>
          s.musician_id === musician_id &&
          s.music_library_id === music_library_id,
      ) ?? null
    );
  }

  async findByMusicianId(musician_id: string): Promise<PersonalChordSheet[]> {
    return this.items.filter((s) => s.musician_id === musician_id);
  }

  async countByMusicianId(musician_id: string): Promise<number> {
    return this.items.filter((s) => s.musician_id === musician_id).length;
  }

  async findSharedByMusicLibraryId(
    music_library_id: string,
    scope?: Exclude<PersonalChordSheetShareScope, "private">,
  ): Promise<PersonalChordSheet[]> {
    return this.items.filter(
      (s) =>
        s.music_library_id === music_library_id &&
        (scope ? s.share_scope === scope : s.share_scope !== "private"),
    );
  }

  async search(
    props: PersonalChordSheetSearchParams,
  ): Promise<PersonalChordSheetSearchResult> {
    const result = await super.search(props);
    return new PersonalChordSheetSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: PersonalChordSheet[],
    filter: PersonalChordSheetFilter | null,
  ): Promise<PersonalChordSheet[]> {
    if (!filter) return items;
    return items.filter((s) => {
      const byMusician = filter.musician_id
        ? s.musician_id === filter.musician_id
        : true;
      const byMusicLibrary = filter.music_library_id
        ? s.music_library_id === filter.music_library_id
        : true;
      const byScope = filter.share_scope
        ? s.share_scope === filter.share_scope
        : true;
      const byReconcile = filter.reconcile_status
        ? s.reconcile_status === filter.reconcile_status
        : true;
      return byMusician && byMusicLibrary && byScope && byReconcile;
    });
  }

  protected applySort(
    items: PersonalChordSheet[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ): PersonalChordSheet[] {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "updated_at", "desc");
  }

  getEntity(): new (...args: any[]) => PersonalChordSheet {
    return PersonalChordSheet;
  }
}
