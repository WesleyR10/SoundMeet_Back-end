import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ISyncedLyricsRepository } from "../../../domain";
import {
  SyncedLyricsFilter,
  SyncedLyricsSearchParams,
  SyncedLyricsSearchResult,
} from "../../../domain/synced-lyrics.repository";
import {
  SyncedLyricsOutput,
  SyncedLyricsOutputMapper,
} from "../common/synced-lyrics-output";
import { SearchSyncedLyricsInput } from "./search-synced-lyrics.input";

export class SearchSyncedLyricsUseCase implements IUseCase<
  SearchSyncedLyricsInput,
  SearchSyncedLyricsOutput
> {
  constructor(private readonly repo: ISyncedLyricsRepository) {}

  async execute(
    input: SearchSyncedLyricsInput,
  ): Promise<SearchSyncedLyricsOutput> {
    const filter: SyncedLyricsFilter = {
      musician_id: input.musician_id,
      ...(input.query ? { query: input.query } : {}),
      ...(typeof input.has_lrc === "boolean" ? { has_lrc: input.has_lrc } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.hash ? { hash: input.hash } : {}),
    };

    const params = SyncedLyricsSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: Object.keys(filter).length ? filter : null,
    });

    const searchResult = await this.repo.search(params);

    return this.toOutput(searchResult, { include_raw: input.include_raw });
  }

  private toOutput(
    searchResult: SyncedLyricsSearchResult,
    options?: { include_raw?: boolean },
  ): SearchSyncedLyricsOutput {
    const items = searchResult.items.map((item) =>
      SyncedLyricsOutputMapper.toOutput(item, {
        include_raw: options?.include_raw === true,
      }),
    );
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}

export type SearchSyncedLyricsOutput = PaginationOutput<SyncedLyricsOutput>;
