import { Uuid } from "../../../shared/domain";
import { MusicLibrary, MusicLibraryId } from "../music-library.aggregate";

describe("MusicLibrary Unit Tests without validator", () => {
  beforeEach(() => {
    MusicLibrary.prototype.validate = jest
      .fn()
      .mockImplementation(MusicLibrary.prototype.validate);
  });

  test("constructor of music library", () => {
    const musicianId = new Uuid();
    let entity = new MusicLibrary({
      musician_id: musicianId,
      title: "Wonderwall",
      artist: "Oasis",
    });
    expect(entity.music_library_id).toBeInstanceOf(MusicLibraryId);
    expect(entity.musician_id).toBe(musicianId);
    expect(entity.title).toBe("Wonderwall");
    expect(entity.artist).toBe("Oasis");
    expect(entity.genre).toBeNull();
    expect(entity.key).toBeNull();
    expect(entity.bpm).toBeNull();
    expect(entity.lyrics).toBeNull();
    expect(entity.chords).toBeNull();
    expect(entity.structure_segments).toBeNull();
    expect(entity.chord_sheet).toBeNull();
    expect(entity.chord_sheet_version).toBe(0);
    expect(entity.renderable_chord_sheet).toBeNull();
    expect(entity.renderable_chord_sheet_version).toBe(0);
    expect(entity.notes).toBeNull();
    expect(entity.difficulty).toBe(1);
    expect(entity.is_favorite).toBe(false);
    expect(entity.source).toBeNull();
    expect(entity.source_id).toBeNull();
    expect(entity.lrc_raw).toBeNull();
    expect(entity.lrc_normalized).toBeNull();
    expect(entity.lrc_provider).toBeNull();
    expect(entity.lrc_provider_meta).toBeNull();
    expect(entity.lrc_hash).toBeNull();
    expect(entity.lrc_version).toBe(1);
    expect(entity.lrc_pipeline_version).toBe(1);
    expect(entity.lrc_quality_flags).toEqual([]);
    expect(entity.lrc_coverage_ms).toBeNull();
    expect(entity.lrc_has_word_timestamps).toBe(false);
    expect(entity.lrc_last_synced_at).toBeNull();
    expect(entity.created_at).toBeInstanceOf(Date);
    expect(entity.updated_at).toBeInstanceOf(Date);

    const created_at = new Date();
    entity = new MusicLibrary({
      musician_id: musicianId,
      title: "Creep",
      artist: "Radiohead",
      genre: "Alternative",
      key: "G",
      bpm: 92,
      lyrics: "When you were here before...",
      chords: { sections: ["G", "B"] },
      structure_segments: [{ type: "intro" }],
      chord_sheet: { v: 1 },
      chord_sheet_version: 3,
      renderable_chord_sheet: { html: "<div/>" },
      renderable_chord_sheet_version: 2,
      notes: "personal note",
      difficulty: 4,
      is_favorite: true,
      source: "cifra_club",
      source_id: "abc123",
      lrc_raw: "[00:01.00]line",
      lrc_normalized: { lines: [] },
      lrc_provider: "lrclib",
      lrc_provider_meta: { lang: "en" },
      lrc_hash: "hash",
      lrc_version: 5,
      lrc_pipeline_version: 2,
      lrc_quality_flags: ["clean"],
      lrc_coverage_ms: 1000,
      lrc_has_word_timestamps: true,
      lrc_last_synced_at: created_at,
      created_at,
    });
    expect(entity.title).toBe("Creep");
    expect(entity.artist).toBe("Radiohead");
    expect(entity.genre).toBe("Alternative");
    expect(entity.key).toBe("G");
    expect(entity.bpm).toBe(92);
    expect(entity.difficulty).toBe(4);
    expect(entity.is_favorite).toBe(true);
    expect(entity.source).toBe("cifra_club");
    expect(entity.source_id).toBe("abc123");
    expect(entity.chord_sheet_version).toBe(3);
    expect(entity.renderable_chord_sheet_version).toBe(2);
    expect(entity.lrc_version).toBe(5);
    expect(entity.lrc_quality_flags).toEqual(["clean"]);
    expect(entity.lrc_has_word_timestamps).toBe(true);
    expect(entity.created_at).toBe(created_at);
  });

  test("should have an id", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Song",
      artist: "Artist",
    });
    expect(entity.music_library_id).toBeDefined();
    expect(entity.music_library_id).toBeInstanceOf(MusicLibraryId);
  });

  test("should create music library with create method", () => {
    const musicianId = new Uuid().id;
    const entity = MusicLibrary.create({
      musician_id: musicianId,
      title: "Song",
      artist: "Artist",
    });
    expect(entity.music_library_id).toBeInstanceOf(MusicLibraryId);
    expect(entity.musician_id).toBeInstanceOf(Uuid);
    expect(entity.musician_id.id).toBe(musicianId);
    expect(entity.title).toBe("Song");
    expect(entity.artist).toBe("Artist");
    expect(MusicLibrary.prototype.validate).toHaveBeenCalledTimes(1);
    expect(MusicLibrary.prototype.validate).toHaveBeenCalledWith([
      "title",
      "artist",
      "difficulty",
    ]);
  });

  test("should change title", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Old",
      artist: "Artist",
    });
    entity.changeTitle("New");
    expect(entity.title).toBe("New");
    expect(MusicLibrary.prototype.validate).toHaveBeenCalledWith(["title"]);
  });

  test("should change artist", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Song",
      artist: "Old",
    });
    entity.changeArtist("New Artist");
    expect(entity.artist).toBe("New Artist");
    expect(MusicLibrary.prototype.validate).toHaveBeenCalledWith(["artist"]);
  });

  test("should change genre, key, bpm, lyrics and notes", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Song",
      artist: "Artist",
    });
    entity.changeGenre("Jazz");
    expect(entity.genre).toBe("Jazz");
    entity.changeKey("Am");
    expect(entity.key).toBe("Am");
    entity.changeBpm(120);
    expect(entity.bpm).toBe(120);
    entity.changeLyrics("la la la");
    expect(entity.lyrics).toBe("la la la");
    entity.changeNotes("a note");
    expect(entity.notes).toBe("a note");
  });

  test("should add error when bpm is negative", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Song",
      artist: "Artist",
    });
    entity.changeBpm(-5);
    expect(entity.notification.hasErrors()).toBe(true);
    expect(entity.bpm).toBeNull();
  });

  test("should mark and unmark as favorite", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Song",
      artist: "Artist",
    });
    entity.markFavorite();
    expect(entity.is_favorite).toBe(true);
    entity.unmarkFavorite();
    expect(entity.is_favorite).toBe(false);
  });

  test("should change difficulty when valid", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Song",
      artist: "Artist",
    });
    entity.changeDifficulty(3);
    expect(entity.difficulty).toBe(3);
  });

  test("should add error when difficulty is out of range", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Song",
      artist: "Artist",
    });
    entity.changeDifficulty(6);
    expect(entity.notification.hasErrors()).toBe(true);
    expect(entity.difficulty).toBe(1);
  });

  test("should update chord sheet and increment version", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Song",
      artist: "Artist",
    });
    expect(entity.chord_sheet_version).toBe(0);
    entity.updateChordSheet({ v: "data" });
    expect(entity.chord_sheet).toEqual({ v: "data" });
    expect(entity.chord_sheet_version).toBe(1);
    entity.updateChordSheet({ v: "data2" });
    expect(entity.chord_sheet_version).toBe(2);
  });

  test("should update renderable chord sheet and increment version", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Song",
      artist: "Artist",
    });
    expect(entity.renderable_chord_sheet_version).toBe(0);
    entity.updateRenderableChordSheet({ html: "<p/>" });
    expect(entity.renderable_chord_sheet).toEqual({ html: "<p/>" });
    expect(entity.renderable_chord_sheet_version).toBe(1);
  });

  test("should update lrc and increment lrc version", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Song",
      artist: "Artist",
    });
    expect(entity.lrc_version).toBe(1);
    entity.updateLrc({
      lrc_raw: "[00:01.00]hello",
      lrc_normalized: { lines: [] },
      lrc_provider: "lrclib",
      lrc_hash: "abc",
      lrc_quality_flags: ["clean"],
      lrc_has_word_timestamps: true,
    });
    expect(entity.lrc_raw).toBe("[00:01.00]hello");
    expect(entity.lrc_normalized).toEqual({ lines: [] });
    expect(entity.lrc_provider).toBe("lrclib");
    expect(entity.lrc_hash).toBe("abc");
    expect(entity.lrc_quality_flags).toEqual(["clean"]);
    expect(entity.lrc_has_word_timestamps).toBe(true);
    expect(entity.lrc_last_synced_at).toBeInstanceOf(Date);
    expect(entity.lrc_version).toBe(2);
  });

  test("should clear lrc and increment lrc version", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Song",
      artist: "Artist",
      lrc_raw: "[00:01.00]hello",
      lrc_normalized: { lines: [] },
      lrc_provider: "lrclib",
      lrc_hash: "abc",
      lrc_version: 3,
    });
    entity.clearLrc();
    expect(entity.lrc_raw).toBeNull();
    expect(entity.lrc_normalized).toBeNull();
    expect(entity.lrc_provider).toBeNull();
    expect(entity.lrc_hash).toBeNull();
    expect(entity.lrc_quality_flags).toEqual([]);
    expect(entity.lrc_has_word_timestamps).toBe(false);
    expect(entity.lrc_version).toBe(4);
  });

  test("should compute helper getters", () => {
    const entity = new MusicLibrary({
      musician_id: new Uuid(),
      title: "Song",
      artist: "Artist",
      lyrics: "some lyrics",
      chord_sheet: { v: 1 },
      lrc_raw: "[00:01.00]x",
      lrc_normalized: { lines: [] },
      difficulty: 5,
    });
    expect(entity.displayName).toBe("Artist - Song");
    expect(entity.hasLyrics).toBe(true);
    expect(entity.hasChordSheet).toBe(true);
    expect(entity.hasLrc).toBe(true);
    expect(entity.isHard).toBe(true);
  });

  test("should convert to JSON", () => {
    const musicianId = new Uuid();
    const entity = new MusicLibrary({
      musician_id: musicianId,
      title: "Song",
      artist: "Artist",
      difficulty: 2,
    });

    const json = entity.toJSON();
    expect(json).toEqual({
      music_library_id: entity.music_library_id.id,
      musician_id: musicianId.id,
      title: "Song",
      artist: "Artist",
      genre: null,
      key: null,
      bpm: null,
      lyrics: null,
      chords: null,
      structure_segments: null,
      chord_sheet: null,
      chord_sheet_version: 0,
      renderable_chord_sheet: null,
      renderable_chord_sheet_version: 0,
      notes: null,
      difficulty: 2,
      is_favorite: false,
      source: null,
      source_id: null,
      lrc_raw: null,
      lrc_normalized: null,
      lrc_provider: null,
      lrc_provider_meta: null,
      lrc_hash: null,
      lrc_version: 1,
      lrc_pipeline_version: 1,
      lrc_quality_flags: [],
      lrc_coverage_ms: null,
      lrc_has_word_timestamps: false,
      lrc_last_synced_at: null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      display_name: "Artist - Song",
      has_lyrics: false,
      has_chord_sheet: false,
      has_lrc: false,
      is_hard: false,
    });
  });
});

describe("MusicLibrary Unit Tests with validator", () => {
  describe("create command", () => {
    test("should have validation errors when title is empty", () => {
      const entity = MusicLibrary.create({
        musician_id: new Uuid().id,
        title: "",
        artist: "Artist",
      });
      expect(entity.notification.hasErrors()).toBe(true);
    });

    test("should have validation errors when artist is empty", () => {
      const entity = MusicLibrary.create({
        musician_id: new Uuid().id,
        title: "Song",
        artist: "",
      });
      expect(entity.notification.hasErrors()).toBe(true);
    });

    test("should have validation errors when difficulty is out of range", () => {
      const entity = MusicLibrary.create({
        musician_id: new Uuid().id,
        title: "Song",
        artist: "Artist",
        difficulty: 9,
      });
      expect(entity.notification.hasErrors()).toBe(true);
    });

    test("should create a valid music library", () => {
      expect(() =>
        MusicLibrary.create({
          musician_id: new Uuid().id,
          title: "Song",
          artist: "Artist",
          difficulty: 3,
        }),
      ).not.toThrow();
    });
  });

  describe("changeTitle method", () => {
    test("should have validation errors when title is too long", () => {
      const entity = MusicLibrary.fake().aMusicLibrary().build();
      entity.changeTitle("t".repeat(256));
      expect(entity.notification.hasErrors()).toBe(true);
    });

    test("should change title when valid", () => {
      const entity = MusicLibrary.fake().aMusicLibrary().build();
      expect(() => entity.changeTitle("New Title")).not.toThrow();
      expect(entity.title).toBe("New Title");
    });
  });

  describe("fake builder", () => {
    test("should build a valid music library", () => {
      const entity = MusicLibrary.fake().aMusicLibrary().build();
      expect(entity).toBeInstanceOf(MusicLibrary);
      expect(entity.notification.hasErrors()).toBe(false);
    });

    test("should build many music libraries", () => {
      const entities = MusicLibrary.fake().theMusicLibraries(3).build();
      expect(entities).toHaveLength(3);
    });
  });
});
