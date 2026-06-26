import { AggregateRoot, Uuid } from "../../shared/domain";
import { MusicLibraryValidatorFactory } from "./music-library.validator";
import { MusicLibraryFakeBuilder } from "./music-library-fake.builder";

/**
 * JSON payloads are stored as opaque blobs in the database. The domain keeps
 * them as loosely typed structures (following the synced-lyrics convention)
 * since their internal shape is owned by other bounded contexts (ai-cifra /
 * synced-lyrics) and is not part of this aggregate's invariants.
 */
export const MUSIC_LIBRARY_DERIVED_DATA_POLICY = {
  role: "projection_cache",
  lrc_source_of_truth: "synced-lyrics",
  chord_sheet_source_of_truth: "ai-cifra",
} as const;

export type ChordsData = Record<string, unknown> | unknown[];
export type StructureSegments = Record<string, unknown> | unknown[];
export type ChordSheetData = Record<string, unknown> | unknown[];
export type RenderableChordSheetData = Record<string, unknown> | unknown[];
export type LrcNormalizedData = Record<string, unknown> | unknown[];
export type LrcProviderMeta = Record<string, unknown>;

export type MusicLibrarySource = string;

export type UpdateLrcProps = {
  lrc_raw?: string | null;
  lrc_normalized?: LrcNormalizedData | null;
  lrc_provider?: string | null;
  lrc_provider_meta?: LrcProviderMeta | null;
  lrc_hash?: string | null;
  lrc_pipeline_version?: number;
  lrc_quality_flags?: string[];
  lrc_coverage_ms?: number | null;
  lrc_has_word_timestamps?: boolean;
  lrc_last_synced_at?: Date | null;
};

export type MusicLibraryConstructorProps = {
  music_library_id?: MusicLibraryId;
  musician_id: Uuid;
  title: string;
  artist: string;
  genre?: string | null;
  key?: string | null;
  bpm?: number | null;
  lyrics?: string | null;
  chords?: ChordsData | null;
  structure_segments?: StructureSegments | null;
  chord_sheet?: ChordSheetData | null;
  chord_sheet_version?: number;
  renderable_chord_sheet?: RenderableChordSheetData | null;
  renderable_chord_sheet_version?: number;
  notes?: string | null;
  difficulty?: number;
  is_favorite?: boolean;
  source?: MusicLibrarySource | null;
  source_id?: string | null;
  lrc_raw?: string | null;
  lrc_normalized?: LrcNormalizedData | null;
  lrc_provider?: string | null;
  lrc_provider_meta?: LrcProviderMeta | null;
  lrc_hash?: string | null;
  lrc_version?: number;
  lrc_pipeline_version?: number;
  lrc_quality_flags?: string[];
  lrc_coverage_ms?: number | null;
  lrc_has_word_timestamps?: boolean;
  lrc_last_synced_at?: Date | null;
  /** Duração real da música em segundos; populado pelo pipeline ai-cifra/ai-audio (Bloco 6). */
  duration_seconds?: number | null;
  created_at?: Date;
  updated_at?: Date;
};

export type MusicLibraryCreateCommand = {
  music_library_id?: MusicLibraryId;
  musician_id: string;
  title: string;
  artist: string;
  genre?: string | null;
  key?: string | null;
  bpm?: number | null;
  lyrics?: string | null;
  chords?: ChordsData | null;
  structure_segments?: StructureSegments | null;
  chord_sheet?: ChordSheetData | null;
  renderable_chord_sheet?: RenderableChordSheetData | null;
  notes?: string | null;
  difficulty?: number;
  is_favorite?: boolean;
  source?: MusicLibrarySource | null;
  source_id?: string | null;
};

export class MusicLibraryId extends Uuid {}

export class MusicLibrary extends AggregateRoot {
  music_library_id: MusicLibraryId;
  musician_id: Uuid;
  title: string;
  artist: string;
  genre: string | null;
  key: string | null;
  bpm: number | null;
  lyrics: string | null;
  chords: ChordsData | null;
  structure_segments: StructureSegments | null;
  chord_sheet: ChordSheetData | null;
  chord_sheet_version: number;
  renderable_chord_sheet: RenderableChordSheetData | null;
  renderable_chord_sheet_version: number;
  notes: string | null;
  difficulty: number;
  is_favorite: boolean;
  source: MusicLibrarySource | null;
  source_id: string | null;
  lrc_raw: string | null;
  lrc_normalized: LrcNormalizedData | null;
  lrc_provider: string | null;
  lrc_provider_meta: LrcProviderMeta | null;
  lrc_hash: string | null;
  lrc_version: number;
  lrc_pipeline_version: number;
  lrc_quality_flags: string[];
  lrc_coverage_ms: number | null;
  lrc_has_word_timestamps: boolean;
  lrc_last_synced_at: Date | null;
  duration_seconds: number | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: MusicLibraryConstructorProps) {
    super();
    this.music_library_id = props.music_library_id ?? new MusicLibraryId();
    this.musician_id = props.musician_id;
    this.title = props.title;
    this.artist = props.artist;
    this.genre = props.genre ?? null;
    this.key = props.key ?? null;
    this.bpm = props.bpm ?? null;
    this.lyrics = props.lyrics ?? null;
    this.chords = props.chords ?? null;
    this.structure_segments = props.structure_segments ?? null;
    this.chord_sheet = props.chord_sheet ?? null;
    this.chord_sheet_version = props.chord_sheet_version ?? 0;
    this.renderable_chord_sheet = props.renderable_chord_sheet ?? null;
    this.renderable_chord_sheet_version =
      props.renderable_chord_sheet_version ?? 0;
    this.notes = props.notes ?? null;
    this.difficulty = props.difficulty ?? 1;
    this.is_favorite = props.is_favorite ?? false;
    this.source = props.source ?? null;
    this.source_id = props.source_id ?? null;
    this.lrc_raw = props.lrc_raw ?? null;
    this.lrc_normalized = props.lrc_normalized ?? null;
    this.lrc_provider = props.lrc_provider ?? null;
    this.lrc_provider_meta = props.lrc_provider_meta ?? null;
    this.lrc_hash = props.lrc_hash ?? null;
    this.lrc_version = props.lrc_version ?? 1;
    this.lrc_pipeline_version = props.lrc_pipeline_version ?? 1;
    this.lrc_quality_flags = props.lrc_quality_flags ?? [];
    this.lrc_coverage_ms = props.lrc_coverage_ms ?? null;
    this.lrc_has_word_timestamps = props.lrc_has_word_timestamps ?? false;
    this.lrc_last_synced_at = props.lrc_last_synced_at ?? null;
    this.duration_seconds = props.duration_seconds ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): MusicLibraryId {
    return this.music_library_id;
  }

  static create(command: MusicLibraryCreateCommand): MusicLibrary {
    const entity = new MusicLibrary({
      music_library_id: command.music_library_id,
      musician_id: new Uuid(command.musician_id),
      title: command.title,
      artist: command.artist,
      genre: command.genre,
      key: command.key,
      bpm: command.bpm,
      lyrics: command.lyrics,
      chords: command.chords,
      structure_segments: command.structure_segments,
      chord_sheet: command.chord_sheet,
      renderable_chord_sheet: command.renderable_chord_sheet,
      notes: command.notes,
      difficulty: command.difficulty,
      is_favorite: command.is_favorite,
      source: command.source,
      source_id: command.source_id,
    });
    entity.validate(["title", "artist", "difficulty"]);
    return entity;
  }

  changeTitle(title: string): void {
    this.title = title;
    this.validate(["title"]);
    this.touch();
  }

  changeArtist(artist: string): void {
    this.artist = artist;
    this.validate(["artist"]);
    this.touch();
  }

  changeGenre(genre: string | null): void {
    this.genre = genre;
    this.touch();
  }

  changeKey(key: string | null): void {
    this.key = key;
    this.touch();
  }

  changeBpm(bpm: number | null): void {
    if (bpm !== null && bpm < 0) {
      this.notification.addError("BPM cannot be negative", "bpm");
      return;
    }
    this.bpm = bpm;
    this.touch();
  }

  changeLyrics(lyrics: string | null): void {
    this.lyrics = lyrics;
    this.touch();
  }

  changeNotes(notes: string | null): void {
    this.notes = notes;
    this.touch();
  }

  changeDifficulty(difficulty: number): void {
    if (difficulty < 1 || difficulty > 5) {
      this.notification.addError(
        "Difficulty must be between 1 and 5",
        "difficulty",
      );
      return;
    }
    this.difficulty = difficulty;
    this.touch();
  }

  changeSource(source: string | null, source_id?: string | null): void {
    this.source = source;
    if (source_id !== undefined) {
      this.source_id = source_id;
    }
    this.touch();
  }

  markFavorite(): void {
    this.is_favorite = true;
    this.touch();
  }

  unmarkFavorite(): void {
    this.is_favorite = false;
    this.touch();
  }

  updateChords(chords: ChordsData | null): void {
    this.chords = chords;
    this.touch();
  }

  updateStructureSegments(segments: StructureSegments | null): void {
    this.structure_segments = segments;
    this.touch();
  }

  updateChordSheet(chord_sheet: ChordSheetData | null): void {
    this.chord_sheet = chord_sheet;
    this.chord_sheet_version += 1;
    this.touch();
  }

  updateRenderableChordSheet(
    renderable_chord_sheet: RenderableChordSheetData | null,
  ): void {
    this.renderable_chord_sheet = renderable_chord_sheet;
    this.renderable_chord_sheet_version += 1;
    this.touch();
  }

  updateLrc(props: UpdateLrcProps): void {
    if (props.lrc_raw !== undefined) {
      this.lrc_raw = props.lrc_raw;
    }
    if (props.lrc_normalized !== undefined) {
      this.lrc_normalized = props.lrc_normalized;
    }
    if (props.lrc_provider !== undefined) {
      this.lrc_provider = props.lrc_provider;
    }
    if (props.lrc_provider_meta !== undefined) {
      this.lrc_provider_meta = props.lrc_provider_meta;
    }
    if (props.lrc_hash !== undefined) {
      this.lrc_hash = props.lrc_hash;
    }
    if (props.lrc_pipeline_version !== undefined) {
      this.lrc_pipeline_version = props.lrc_pipeline_version;
    }
    if (props.lrc_quality_flags !== undefined) {
      this.lrc_quality_flags = props.lrc_quality_flags;
    }
    if (props.lrc_coverage_ms !== undefined) {
      this.lrc_coverage_ms = props.lrc_coverage_ms;
    }
    if (props.lrc_has_word_timestamps !== undefined) {
      this.lrc_has_word_timestamps = props.lrc_has_word_timestamps;
    }
    this.lrc_last_synced_at = props.lrc_last_synced_at ?? new Date();
    this.lrc_version += 1;
    this.touch();
  }

  clearLrc(): void {
    this.lrc_raw = null;
    this.lrc_normalized = null;
    this.lrc_provider = null;
    this.lrc_provider_meta = null;
    this.lrc_hash = null;
    this.lrc_quality_flags = [];
    this.lrc_coverage_ms = null;
    this.lrc_has_word_timestamps = false;
    this.lrc_last_synced_at = new Date();
    this.lrc_version += 1;
    this.touch();
  }

  private touch(): void {
    this.updated_at = new Date();
  }

  get displayName(): string {
    return `${this.artist} - ${this.title}`;
  }

  get hasLyrics(): boolean {
    return !!this.lyrics && this.lyrics.trim().length > 0;
  }

  get hasChordSheet(): boolean {
    return this.chord_sheet !== null;
  }

  get hasLrc(): boolean {
    return this.lrc_raw !== null && this.lrc_normalized !== null;
  }

  get isHard(): boolean {
    return this.difficulty >= 4;
  }

  validate(fields?: string[]): boolean {
    const validator = MusicLibraryValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return MusicLibraryFakeBuilder;
  }

  toJSON() {
    return {
      music_library_id: this.music_library_id.id,
      musician_id: this.musician_id.id,
      title: this.title,
      artist: this.artist,
      genre: this.genre,
      key: this.key,
      bpm: this.bpm,
      lyrics: this.lyrics,
      chords: this.chords,
      structure_segments: this.structure_segments,
      chord_sheet: this.chord_sheet,
      chord_sheet_version: this.chord_sheet_version,
      renderable_chord_sheet: this.renderable_chord_sheet,
      renderable_chord_sheet_version: this.renderable_chord_sheet_version,
      notes: this.notes,
      difficulty: this.difficulty,
      is_favorite: this.is_favorite,
      source: this.source,
      source_id: this.source_id,
      lrc_raw: this.lrc_raw,
      lrc_normalized: this.lrc_normalized,
      lrc_provider: this.lrc_provider,
      lrc_provider_meta: this.lrc_provider_meta,
      lrc_hash: this.lrc_hash,
      lrc_version: this.lrc_version,
      lrc_pipeline_version: this.lrc_pipeline_version,
      lrc_quality_flags: this.lrc_quality_flags,
      lrc_coverage_ms: this.lrc_coverage_ms,
      lrc_has_word_timestamps: this.lrc_has_word_timestamps,
      lrc_last_synced_at: this.lrc_last_synced_at,
      duration_seconds: this.duration_seconds,
      created_at: this.created_at,
      updated_at: this.updated_at,
      display_name: this.displayName,
      has_lyrics: this.hasLyrics,
      has_chord_sheet: this.hasChordSheet,
      has_lrc: this.hasLrc,
      is_hard: this.isHard,
    };
  }
}
