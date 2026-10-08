import { Uuid } from "@core/shared/domain";
import { EntityValidationError } from "@core/shared/domain/validators/validation.error";

import { SyncedLyrics } from "../../../../domain/synced-lyrics.aggregate";
import { SyncSyncedLyricsForMusicLibraryUseCase } from "../sync-synced-lyrics-for-music-library.use-case";

describe("SyncSyncedLyricsForMusicLibraryUseCase Unit Tests", () => {
  it("should fetch from LRCLIB and update entity", async () => {
    const musicianId = new Uuid();
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withMusicianId(musicianId)
      .withLrcRaw(() => null)
      .withLrcProvider(() => null)
      .build();

    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const lrclib = {
      findLyrics: jest.fn().mockResolvedValue({
        id: 123,
        name: "Song",
        trackName: entity.title,
        artistName: entity.artist,
        albumName: "Album",
        duration: 200,
        instrumental: false,
        plainLyrics: null,
        syncedLyrics: "[00:00.00]Hello\n",
        lang: null,
        isrc: null,
        spotifyId: null,
        releaseDate: null,
      }),
      searchLyrics: jest.fn().mockResolvedValue([]),
    } as any;

    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    } as any;

    const useCase = new SyncSyncedLyricsForMusicLibraryUseCase(
      repo,
      lrclib,
      cache,
    );

    const output = await useCase.execute({
      musician_id: musicianId.id,
      music_library_id: entity.music_library_id.id,
    } as any);

    expect(lrclib.searchLyrics).toHaveBeenCalled();
    expect(lrclib.findLyrics).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(output.lrc_provider).toBe("lrclib");
    expect(output.lrc_hash).toBeTruthy();
  });

  it("should fallback to search when get misses due to noisy youtube title", async () => {
    const musicianId = new Uuid();
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withMusicianId(musicianId)
      .withTitle(
        () => "Diego & Victor Hugo - O Alvo (Ao Vivo) ft. Henrique & Juliano",
      )
      .withArtist(() => "Diego e Victor Hugo")
      .withLrcRaw(() => null)
      .withLrcProvider(() => null)
      .build();

    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const lrclib = {
      findLyrics: jest.fn().mockResolvedValue(null),
      searchLyrics: jest.fn().mockResolvedValue([
        {
          id: 10,
          name: "O Alvo (Ao Vivo)",
          trackName: "O Alvo (Ao Vivo)",
          artistName: "Diego & Victor Hugo feat. Henrique & Juliano",
          albumName: "Intenso",
          duration: 165,
          instrumental: false,
          plainLyrics: null,
          syncedLyrics: "[00:00.00]Hello\n",
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

    const useCase = new SyncSyncedLyricsForMusicLibraryUseCase(
      repo,
      lrclib,
      cache,
    );

    const output = await useCase.execute({
      musician_id: musicianId.id,
      music_library_id: entity.music_library_id.id,
    } as any);

    expect(lrclib.searchLyrics).toHaveBeenCalled();

    const firstCall = lrclib.searchLyrics.mock.calls?.[0]?.[0] ?? {};
    expect(firstCall.q).toBe("O Alvo");

    expect(lrclib.findLyrics).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(output.lrc_provider).toBe("lrcget");
    expect(output.lrc_hash).toBeTruthy();
  });

  it("should keep acoustic token when building LRCLIB search candidates", async () => {
    const musicianId = new Uuid();
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withMusicianId(musicianId)
      .withTitle(() => "Song (Acústico)")
      .withArtist(() => "Artist")
      .withLrcRaw(() => null)
      .withLrcProvider(() => null)
      .build();

    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const lrclib = {
      findLyrics: jest.fn().mockResolvedValue(null),
      searchLyrics: jest.fn().mockResolvedValue([
        {
          id: 11,
          name: "Song (Acústico)",
          trackName: "Song (Acústico)",
          artistName: "Artist",
          albumName: null,
          duration: 180,
          instrumental: false,
          plainLyrics: null,
          syncedLyrics: "[00:00.00]Hello\n",
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

    const useCase = new SyncSyncedLyricsForMusicLibraryUseCase(
      repo,
      lrclib,
      cache,
    );

    const output = await useCase.execute({
      musician_id: musicianId.id,
      music_library_id: entity.music_library_id.id,
    } as any);

    const calledWithAcoustic = lrclib.searchLyrics.mock.calls.some((call) => {
      const params = call?.[0] ?? {};
      const track = String(params.track_name ?? "").toLowerCase();
      const q = String(params.q ?? "").toLowerCase();
      return track.includes("acustico") || q.includes("acustico");
    });

    expect(calledWithAcoustic).toBe(true);
    expect(output.lrc_provider).toBe("lrcget");
    expect(output.lrc_hash).toBeTruthy();
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it("should synthesize LRC from plainLyrics when syncedLyrics is missing", async () => {
    const musicianId = new Uuid();
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withMusicianId(musicianId)
      .withTitle(() => "Song")
      .withArtist(() => "Artist")
      .withLrcRaw(() => null)
      .withLrcProvider(() => null)
      .build();

    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const lrclib = {
      findLyrics: jest.fn().mockResolvedValue({
        id: 321,
        name: "Song",
        trackName: entity.title,
        artistName: entity.artist,
        albumName: null,
        duration: 200,
        instrumental: false,
        plainLyrics: "Hello\nWorld\n",
        syncedLyrics: null,
        lang: null,
        isrc: null,
        spotifyId: null,
        releaseDate: null,
      }),
      searchLyrics: jest.fn().mockResolvedValue([]),
    } as any;

    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    } as any;

    const useCase = new SyncSyncedLyricsForMusicLibraryUseCase(
      repo,
      lrclib,
      cache,
    );

    const output = await useCase.execute({
      musician_id: musicianId.id,
      music_library_id: entity.music_library_id.id,
    } as any);

    expect(lrclib.searchLyrics).toHaveBeenCalled();
    expect(lrclib.findLyrics).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(output.lrc_provider).toBe("lrclib");
    expect(output.lrc_hash).toBeTruthy();
    expect(entity.lrc_raw).toContain("[00:");
    expect(entity.lrc_raw).toContain("Hello");
  });

  it("should use cache and not call LRCLIB", async () => {
    const musicianId = new Uuid();
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withMusicianId(musicianId)
      .withLrcRaw(() => null)
      .withLrcProvider(() => null)
      .build();

    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const lrclib = {
      findLyrics: jest.fn(),
      searchLyrics: jest.fn(),
    } as any;

    const cache = {
      get: jest.fn().mockResolvedValue({
        found: true,
        lyrics: { syncedLyrics: "[00:00.00]Hello\n", meta: null },
      }),
      set: jest.fn().mockResolvedValue(undefined),
    } as any;

    const useCase = new SyncSyncedLyricsForMusicLibraryUseCase(
      repo,
      lrclib,
      cache,
    );

    const output = await useCase.execute({
      musician_id: musicianId.id,
      music_library_id: entity.music_library_id.id,
    } as any);

    expect(lrclib.findLyrics).not.toHaveBeenCalled();
    expect(lrclib.searchLyrics).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(output.lrc_provider).toBe("lrclib");
  });

  it("should throw when cached not found", async () => {
    const musicianId = new Uuid();
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withMusicianId(musicianId)
      .withLrcRaw(() => null)
      .withLrcProvider(() => null)
      .build();

    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const lrclib = {
      findLyrics: jest.fn(),
      searchLyrics: jest.fn(),
    } as any;

    const cache = {
      get: jest.fn().mockResolvedValue({ found: false }),
      set: jest.fn().mockResolvedValue(undefined),
    } as any;

    const useCase = new SyncSyncedLyricsForMusicLibraryUseCase(
      repo,
      lrclib,
      cache,
    );

    await expect(
      useCase.execute({
        musician_id: musicianId.id,
        music_library_id: entity.music_library_id.id,
      } as any),
    ).rejects.toBeInstanceOf(EntityValidationError);

    expect(lrclib.findLyrics).not.toHaveBeenCalled();
    expect(lrclib.searchLyrics).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("should flag duration_mismatch when the best search candidate's duration diverges from the track", async () => {
    const musicianId = new Uuid();
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withMusicianId(musicianId)
      .withTitle(() => "Song")
      .withArtist(() => "Artist")
      .withLrcRaw(() => null)
      .withLrcProvider(() => null)
      .build();
    // duration_seconds não faz parte do fake builder (é um campo projetado
    // de music_library.duration_seconds, ver comentário no aggregate) —
    // setado direto pra simular o que o mapper preencheria na leitura real.
    (entity as any).duration_seconds = 200;

    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const lrclib = {
      findLyrics: jest.fn().mockResolvedValue(null),
      searchLyrics: jest.fn().mockResolvedValue([
        {
          id: 12,
          name: "Song (Ao Vivo Estendido)",
          trackName: "Song",
          artistName: "Artist",
          albumName: null,
          // 380s vs. os 200s da faixa real — diff de 180s, bem acima do
          // bucket "<=12s" que MatchSyncedLyricsOnLrclibUseCase já trata.
          duration: 380,
          instrumental: false,
          plainLyrics: null,
          syncedLyrics: "[00:00.00]Hello\n",
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

    const useCase = new SyncSyncedLyricsForMusicLibraryUseCase(
      repo,
      lrclib,
      cache,
    );

    const output = await useCase.execute({
      musician_id: musicianId.id,
      music_library_id: entity.music_library_id.id,
    } as any);

    expect(output.lrc_quality_flags).toContain("duration_mismatch");
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it("should not flag duration_mismatch when the candidate's duration is close to the track", async () => {
    const musicianId = new Uuid();
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withMusicianId(musicianId)
      .withTitle(() => "Song")
      .withArtist(() => "Artist")
      .withLrcRaw(() => null)
      .withLrcProvider(() => null)
      .build();
    (entity as any).duration_seconds = 200;

    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const lrclib = {
      findLyrics: jest.fn().mockResolvedValue(null),
      searchLyrics: jest.fn().mockResolvedValue([
        {
          id: 13,
          name: "Song",
          trackName: "Song",
          artistName: "Artist",
          albumName: null,
          duration: 201,
          instrumental: false,
          plainLyrics: null,
          syncedLyrics: "[00:00.00]Hello\n",
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

    const useCase = new SyncSyncedLyricsForMusicLibraryUseCase(
      repo,
      lrclib,
      cache,
    );

    const output = await useCase.execute({
      musician_id: musicianId.id,
      music_library_id: entity.music_library_id.id,
    } as any);

    expect(output.lrc_quality_flags).not.toContain("duration_mismatch");
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it("should never persist Genius-scraped full lyrics text (compliance: Genius is metadata/link-out only)", async () => {
    const musicianId = new Uuid();
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withMusicianId(musicianId)
      .withTitle(() => "Some Obscure Song")
      .withArtist(() => "Some Obscure Artist")
      .withLrcRaw(() => null)
      .withLrcProvider(() => null)
      .build();

    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    // LRCLIB nunca acha nada — força cair no fallback Genius.
    const lrclib = {
      findLyrics: jest.fn().mockResolvedValue(null),
      searchLyrics: jest.fn().mockResolvedValue([]),
    } as any;

    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    } as any;

    const genius = {
      findPlainLyrics: jest.fn().mockResolvedValue({
        lyrics: "Letra completa raspada da página do Genius aqui...",
        meta: {
          song_id: 999,
          url: "https://genius.com/some-obscure-song-lyrics",
          full_title: "Some Obscure Song by Some Obscure Artist",
        },
      }),
    } as any;

    const useCase = new SyncSyncedLyricsForMusicLibraryUseCase(
      repo,
      lrclib,
      cache,
      genius,
    );

    let thrown: any = null;
    try {
      await useCase.execute({
        musician_id: musicianId.id,
        music_library_id: entity.music_library_id.id,
      } as any);
    } catch (e) {
      thrown = e;
    }

    // Genius foi consultado (o link-out depende disso), mas NUNCA deve
    // resultar num update persistindo o texto raspado como se fosse LRC.
    expect(genius.findPlainLyrics).toHaveBeenCalledTimes(1);
    expect(repo.update).not.toHaveBeenCalled();
    expect(entity.lrc_raw).toBeNull();
    expect(thrown).toBeInstanceOf(EntityValidationError);

    const errorEntries: Array<Record<string, string[]>> = thrown.error;
    const externalLinkEntry = errorEntries.find((e) => "external_link" in e);
    expect(externalLinkEntry?.external_link).toEqual([
      "https://genius.com/some-obscure-song-lyrics",
    ]);

    // O texto raspado nunca deve aparecer em lugar nenhum do erro lançado.
    expect(JSON.stringify(errorEntries)).not.toContain(
      "Letra completa raspada",
    );
  });
});
