import { MatchSyncedLyricsOnLrclibUseCase } from "../match-synced-lyrics-on-lrclib.use-case";

describe("MatchSyncedLyricsOnLrclibUseCase Unit Tests", () => {
  it("should return cached hit", async () => {
    const lrclib = { searchLyrics: jest.fn() } as any;
    const cache = {
      get: jest.fn().mockResolvedValue({
        found: true,
        items: [
          {
            lrclib_id: 1,
            track_name: "Song",
            artist_name: "Artist",
            album_name: "Album",
            duration_seconds: 200,
            has_synced: true,
            score: 1,
          },
        ],
      }),
      set: jest.fn(),
    } as any;

    const useCase = new MatchSyncedLyricsOnLrclibUseCase(lrclib, cache);
    const output = await useCase.execute({
      artist: "Artist",
      title: "Song",
      duration_ms: 200000,
    } as any);

    expect(output.meta.cache).toBe("hit");
    expect(output.items).toHaveLength(1);
    expect(lrclib.searchLyrics).not.toHaveBeenCalled();
  });

  it("should call LRCLIB and cache miss", async () => {
    const lrclib = {
      searchLyrics: jest.fn().mockResolvedValue([
        {
          id: 10,
          name: "Song",
          trackName: "Song",
          artistName: "Artist",
          albumName: "Album",
          duration: 200,
          instrumental: false,
          plainLyrics: null,
          syncedLyrics: "[00:00.00]Hello",
          lang: null,
          isrc: null,
          spotifyId: null,
          releaseDate: null,
        },
      ]),
    } as any;

    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    } as any;

    const useCase = new MatchSyncedLyricsOnLrclibUseCase(lrclib, cache);
    const output = await useCase.execute({
      artist: "Artist",
      title: "Song",
      duration_ms: 200000,
      max_results: 5,
    } as any);

    expect(output.meta.cache).toBe("miss");
    expect(output.items).toHaveLength(1);
    expect(output.items[0].lrclib_id).toBe(10);
    expect(cache.set).toHaveBeenCalled();
  });

  it("should return negative_hit", async () => {
    const lrclib = { searchLyrics: jest.fn() } as any;
    const cache = {
      get: jest.fn().mockResolvedValue({ found: false }),
      set: jest.fn(),
    } as any;

    const useCase = new MatchSyncedLyricsOnLrclibUseCase(lrclib, cache);
    const output = await useCase.execute({
      artist: "Artist",
      title: "Song",
    } as any);

    expect(output.meta.cache).toBe("negative_hit");
    expect(output.items).toHaveLength(0);
    expect(lrclib.searchLyrics).not.toHaveBeenCalled();
  });
});
