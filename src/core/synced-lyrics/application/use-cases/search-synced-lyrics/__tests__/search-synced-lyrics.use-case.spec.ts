import { Uuid } from "@core/shared/domain";

import { SyncedLyrics } from "../../../../domain/synced-lyrics.aggregate";
import {
  SyncedLyricsSearchParams,
  SyncedLyricsSearchResult,
} from "../../../../domain/synced-lyrics.repository";
import { SearchSyncedLyricsUseCase } from "../search-synced-lyrics.use-case";

describe("SearchSyncedLyricsUseCase Unit Tests", () => {
  it("should search by musician_id and map outputs", async () => {
    const musicianId = new Uuid();
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withMusicianId(musicianId)
      .build();

    const repo = {
      search: jest.fn().mockResolvedValue(
        new SyncedLyricsSearchResult({
          items: [entity],
          total: 1,
          current_page: 1,
          per_page: 15,
        }),
      ),
    } as any;

    const useCase = new SearchSyncedLyricsUseCase(repo);

    const output = await useCase.execute({
      musician_id: musicianId.id,
    } as any);

    const searchCall = (repo.search as jest.Mock).mock.calls[0][0];
    expect(searchCall).toBeInstanceOf(SyncedLyricsSearchParams);
    expect(searchCall.filter).toEqual({ musician_id: musicianId.id });

    expect(output.items).toHaveLength(1);
    expect(output.items[0].music_library_id).toBe(entity.music_library_id.id);
    expect(output.items[0].musician_id).toBe(musicianId.id);
    expect(output.items[0]).not.toHaveProperty("lrc_raw");
  });
  it("should support filters and include_raw", async () => {
    const musicianId = new Uuid();
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withMusicianId(musicianId)
      .build();

    const repo = {
      search: jest.fn().mockResolvedValue(
        new SyncedLyricsSearchResult({
          items: [entity],
          total: 1,
          current_page: 2,
          per_page: 10,
        }),
      ),
    } as any;

    const useCase = new SearchSyncedLyricsUseCase(repo);

    const output = await useCase.execute({
      musician_id: musicianId.id,
      page: 2,
      per_page: 10,
      sort: "updated_at",
      sort_dir: "asc",
      query: "hello",
      has_lrc: true,
      provider: "ugc",
      hash: entity.lrc_hash,
      include_raw: true,
    } as any);

    const searchCall = (repo.search as jest.Mock).mock.calls[0][0];
    expect(searchCall.filter).toEqual({
      musician_id: musicianId.id,
      query: "hello",
      has_lrc: true,
      provider: "ugc",
      hash: entity.lrc_hash,
    });

    expect(output.current_page).toBe(2);
    expect(output.per_page).toBe(10);
    expect(output.items[0]).toHaveProperty("lrc_raw");
  });
});
