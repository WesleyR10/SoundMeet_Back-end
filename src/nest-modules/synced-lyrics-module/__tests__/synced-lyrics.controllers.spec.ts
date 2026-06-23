import { SyncedLyricsController } from "../synced-lyrics.controller";
import {
  LrcLibMatchPresenter,
  MaterializeChordSheetsPresenter,
  SyncedLyricsBulkJobPresenter,
  SyncedLyricsCollectionPresenter,
  SyncedLyricsPresenter,
} from "../synced-lyrics.presenter";
import { SyncedLyricsLrclibController } from "../synced-lyrics-lrclib.controller";

const now = new Date("2026-06-19T12:00:00.000Z");

function syncedLyricsOutput(overrides: Record<string, unknown> = {}) {
  return {
    music_library_id: "11111111-1111-4111-8111-111111111111",
    musician_id: "22222222-2222-4222-8222-222222222222",
    title: "Song",
    artist: "Artist",
    lrc_raw: "[00:01.00]hello",
    lrc_provider: "lrclib",
    lrc_provider_meta: null,
    lrc_hash: "hash",
    lrc_version: 1,
    lrc_pipeline_version: 1,
    lrc_normalized: { sections: [] },
    lrc_quality_flags: [],
    lrc_coverage_ms: 1000,
    lrc_has_word_timestamps: false,
    lrc_last_synced_at: now,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function bulkJobOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    musician_id: "22222222-2222-4222-8222-222222222222",
    status: "queued",
    total: 2,
    processed: 0,
    success: 0,
    failed: 0,
    error_summary: null,
    started_at: null,
    finished_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function inject(controller: object, key: string, execute = jest.fn()) {
  (controller as any)[key] = { execute };
  return execute;
}

describe("SyncedLyrics Controllers Unit Tests", () => {
  describe("SyncedLyricsController", () => {
    let controller: SyncedLyricsController;

    beforeEach(() => {
      controller = new SyncedLyricsController();
    });

    it("should search lyrics converting boolean query strings", async () => {
      const execute = inject(
        controller,
        "searchUseCase",
        jest.fn().mockResolvedValue({
          items: [syncedLyricsOutput()],
          current_page: 1,
          per_page: 10,
          last_page: 1,
          total: 1,
        }),
      );

      const presenter = await controller.search({
        musician_id: "22222222-2222-4222-8222-222222222222",
        has_lrc: "true",
        include_raw: "false",
        page: 1,
        per_page: 10,
      });

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          musician_id: "22222222-2222-4222-8222-222222222222",
          has_lrc: true,
          include_raw: false,
        }),
      );
      expect(presenter).toBeInstanceOf(SyncedLyricsCollectionPresenter);
      expect(presenter.data).toHaveLength(1);
    });

    it("should upsert synced lyrics for a music library item", async () => {
      const execute = inject(
        controller,
        "upsertUseCase",
        jest.fn().mockResolvedValue(syncedLyricsOutput()),
      );

      const presenter = await controller.upsert(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        {
          raw: "[00:01.00]hello",
          provider: "lrclib",
          pipeline_version: 1,
        },
      );

      expect(execute).toHaveBeenCalledWith({
        musician_id: "22222222-2222-4222-8222-222222222222",
        music_library_id: "11111111-1111-4111-8111-111111111111",
        raw: "[00:01.00]hello",
        provider: "lrclib",
        provider_meta: null,
        pipeline_version: 1,
      });
      expect(presenter).toBeInstanceOf(SyncedLyricsPresenter);
    });

    it("should materialize chord sheets through protected bulk use case", async () => {
      const execute = inject(
        controller,
        "materializeChordSheetsUseCase",
        jest.fn().mockResolvedValue({
          musician_id: "22222222-2222-4222-8222-222222222222",
          items: [
            {
              music_library_id: "11111111-1111-4111-8111-111111111111",
              status: "materialized",
              updated: true,
            },
          ],
        }),
      );

      const presenter = await controller.materializeChordSheets({
        musician_id: "22222222-2222-4222-8222-222222222222",
        music_library_ids: ["11111111-1111-4111-8111-111111111111"],
        force: true,
      });

      expect(execute).toHaveBeenCalledWith({
        musician_id: "22222222-2222-4222-8222-222222222222",
        music_library_ids: ["11111111-1111-4111-8111-111111111111"],
        force: true,
      });
      expect(presenter).toBeInstanceOf(MaterializeChordSheetsPresenter);
      expect(presenter.items[0].status).toBe("materialized");
    });
  });

  describe("SyncedLyricsLrclibController", () => {
    let controller: SyncedLyricsLrclibController;

    beforeEach(() => {
      controller = new SyncedLyricsLrclibController();
    });

    it("should map LRCLIB search query to core input", async () => {
      const execute = inject(
        controller,
        "matchUseCase",
        jest.fn().mockResolvedValue({
          items: [
            {
              lrclib_id: 123,
              track_name: "Song",
              artist_name: "Artist",
              album_name: "Album",
              duration_seconds: 180,
              has_synced: true,
              score: 0.95,
            },
          ],
          meta: { cache: "miss", key: "lrclib:match:artist:song:180000" },
        }),
      );

      const presenter = await controller.search({
        artist: "Artist",
        title: "Song",
        durationMs: 180000,
        maxResults: 5,
      });

      expect(execute).toHaveBeenCalledWith({
        artist: "Artist",
        title: "Song",
        duration_ms: 180000,
        max_results: 5,
      });
      expect(presenter).toBeInstanceOf(LrcLibMatchPresenter);
      expect(presenter.items[0].lrclib_id).toBe(123);
    });

    it("should request and read protected bulk jobs", async () => {
      const request = inject(
        controller,
        "requestBulkUseCase",
        jest.fn().mockResolvedValue(bulkJobOutput()),
      );
      const get = inject(
        controller,
        "getBulkJobUseCase",
        jest.fn().mockResolvedValue(bulkJobOutput({ status: "processing" })),
      );

      const requested = await controller.requestBulkSync({
        musician_id: "22222222-2222-4222-8222-222222222222",
        music_library_ids: [
          "11111111-1111-4111-8111-111111111111",
          "44444444-4444-4444-8444-444444444444",
        ],
        force: true,
      });
      const found = await controller.getBulkJob(
        "33333333-3333-4333-8333-333333333333",
      );

      expect(request).toHaveBeenCalledWith({
        musician_id: "22222222-2222-4222-8222-222222222222",
        music_library_ids: [
          "11111111-1111-4111-8111-111111111111",
          "44444444-4444-4444-8444-444444444444",
        ],
        force: true,
      });
      expect(get).toHaveBeenCalledWith({
        id: "33333333-3333-4333-8333-333333333333",
      });
      expect(requested).toBeInstanceOf(SyncedLyricsBulkJobPresenter);
      expect(found.status).toBe("processing");
    });
  });
});
