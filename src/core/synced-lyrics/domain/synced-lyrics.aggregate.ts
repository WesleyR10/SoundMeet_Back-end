import { AggregateRoot, Uuid } from "../../shared/domain";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { SyncedLyricsValidatorFactory } from "./synced-lyrics.validator";
import { SyncedLyricsFakeBuilder } from "./synced-lyrics-fake.builder";
import {
  InvalidLrcError,
  LrcParser,
  SyncedLyricsNormalized,
} from "./value-objects/lrc.vo";

export const SYNCED_LYRICS_SOURCE_OF_TRUTH_POLICY = {
  role: "lrc_source_of_truth",
  projected_to: "music-library",
  projection_fields: [
    "lrc_raw",
    "lrc_normalized",
    "lrc_provider",
    "lrc_provider_meta",
    "lrc_hash",
    "lrc_version",
    "lrc_pipeline_version",
    "lrc_quality_flags",
    "lrc_coverage_ms",
    "lrc_has_word_timestamps",
    "lrc_last_synced_at",
  ],
} as const;

export type SyncedLyricsConstructorProps = {
  synced_lyrics_id?: SyncedLyricsId;
  music_library_id: SyncedLyricsId;
  musician_id: Uuid;
  title: string;
  artist: string;
  lrc_raw?: string | null;
  lrc_provider?: string | null;
  lrc_provider_meta?: Record<string, unknown> | null;
  lrc_hash?: string | null;
  lrc_version?: number;
  lrc_pipeline_version?: number;
  lrc_normalized?: SyncedLyricsNormalized | null;
  lrc_quality_flags?: string[];
  lrc_coverage_ms?: number | null;
  lrc_has_word_timestamps?: boolean;
  lrc_last_synced_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
};

export type SyncedLyricsCreateCommand = {
  music_library_id: string;
  musician_id: string;
  title: string;
  artist: string;
};

export type SyncedLyricsUpsertFromRawCommand = {
  raw: string;
  provider: string;
  provider_meta?: Record<string, unknown> | null;
  pipeline_version?: number;
};

export class SyncedLyricsId extends Uuid {}

export class SyncedLyrics extends AggregateRoot {
  synced_lyrics_id: SyncedLyricsId;
  music_library_id: SyncedLyricsId;
  musician_id: Uuid;
  title: string;
  artist: string;

  lrc_raw: string | null;
  lrc_provider: string | null;
  lrc_provider_meta: Record<string, unknown> | null;
  lrc_hash: string | null;
  lrc_version: number;
  lrc_pipeline_version: number;
  lrc_normalized: SyncedLyricsNormalized | null;
  lrc_quality_flags: string[];
  lrc_coverage_ms: number | null;
  lrc_has_word_timestamps: boolean;
  lrc_last_synced_at: Date | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: SyncedLyricsConstructorProps) {
    super();
    this.synced_lyrics_id = props.synced_lyrics_id ?? props.music_library_id;
    this.music_library_id = props.music_library_id;
    this.musician_id = props.musician_id;
    this.title = props.title;
    this.artist = props.artist;

    this.lrc_raw = props.lrc_raw ?? null;
    this.lrc_provider = props.lrc_provider ?? null;
    this.lrc_provider_meta = props.lrc_provider_meta ?? null;
    this.lrc_hash = props.lrc_hash ?? null;
    this.lrc_version = props.lrc_version ?? 1;
    this.lrc_pipeline_version = props.lrc_pipeline_version ?? 1;
    this.lrc_normalized = props.lrc_normalized ?? null;
    this.lrc_quality_flags = props.lrc_quality_flags ?? [];
    this.lrc_coverage_ms = props.lrc_coverage_ms ?? null;
    this.lrc_has_word_timestamps = props.lrc_has_word_timestamps ?? false;
    this.lrc_last_synced_at = props.lrc_last_synced_at ?? null;

    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  static create(command: SyncedLyricsCreateCommand): SyncedLyrics {
    const entity = new SyncedLyrics({
      music_library_id: new SyncedLyricsId(command.music_library_id),
      musician_id: new Uuid(command.musician_id),
      title: command.title,
      artist: command.artist,
    });
    entity.validate();
    return entity;
  }

  upsertFromRaw(command: SyncedLyricsUpsertFromRawCommand, now: Date): void {
    const parsed = LrcParser.parse({
      raw: command.raw,
      provider: command.provider,
      pipeline_version: command.pipeline_version ?? this.lrc_pipeline_version,
    });
    if (parsed.isFail()) {
      this.notification.addError(parsed.error.message, "lrc_raw");
      return;
    }

    this.lrc_raw = parsed.ok.raw;
    this.lrc_provider = parsed.ok.provider;
    this.lrc_provider_meta = command.provider_meta ?? null;
    this.lrc_hash = parsed.ok.hash;
    this.lrc_pipeline_version = parsed.ok.normalized.pipeline_version;
    this.lrc_normalized = parsed.ok.normalized;
    this.lrc_quality_flags = parsed.ok.quality.flags;
    this.lrc_coverage_ms = parsed.ok.quality.coverage_ms;
    this.lrc_has_word_timestamps = parsed.ok.quality.has_word_timestamps;
    this.lrc_last_synced_at = now;
    this.lrc_version += 1;
    this.updated_at = now;

    this.validate();
  }

  clear(now: Date): void {
    this.lrc_raw = null;
    this.lrc_provider = null;
    this.lrc_provider_meta = null;
    this.lrc_hash = null;
    this.lrc_normalized = null;
    this.lrc_quality_flags = [];
    this.lrc_coverage_ms = null;
    this.lrc_has_word_timestamps = false;
    this.lrc_last_synced_at = now;
    this.lrc_version += 1;
    this.updated_at = now;

    this.validate();
  }

  validate(fields?: string[]): boolean {
    const validator = SyncedLyricsValidatorFactory.create();
    const isValid = validator.validate(this.notification, this, fields);

    if (this.lrc_raw !== null) {
      if (!this.lrc_provider || String(this.lrc_provider).trim().length === 0) {
        this.notification.addError("lrc_provider is required", "lrc_provider");
      }

      if (!this.lrc_hash) {
        this.notification.addError("lrc_hash is required", "lrc_hash");
      }

      if (!this.lrc_normalized) {
        this.notification.addError(
          "lrc_normalized is required",
          "lrc_normalized",
        );
      }
    }

    if (this.lrc_pipeline_version <= 0) {
      this.notification.addError(
        "lrc_pipeline_version must be greater than 0",
        "lrc_pipeline_version",
      );
    }

    if (this.lrc_version <= 0) {
      this.notification.addError(
        "lrc_version must be greater than 0",
        "lrc_version",
      );
    }

    return isValid && !this.notification.hasErrors();
  }

  ensureParsedOrThrow() {
    if (this.lrc_raw === null) {
      throw new InvalidLrcError("LRC is empty");
    }
    if (!this.lrc_normalized || !this.lrc_hash) {
      throw new EntityValidationError(this.notification.toJSON());
    }
  }

  static fake() {
    return SyncedLyricsFakeBuilder;
  }

  get entity_id(): SyncedLyricsId {
    return this.synced_lyrics_id;
  }

  toJSON() {
    return {
      synced_lyrics_id: this.synced_lyrics_id.id,
      music_library_id: this.music_library_id.id,
      musician_id: this.musician_id.id,
      title: this.title,
      artist: this.artist,
      lrc_raw: this.lrc_raw,
      lrc_provider: this.lrc_provider,
      lrc_provider_meta: this.lrc_provider_meta,
      lrc_hash: this.lrc_hash,
      lrc_version: this.lrc_version,
      lrc_pipeline_version: this.lrc_pipeline_version,
      lrc_normalized: this.lrc_normalized,
      lrc_quality_flags: this.lrc_quality_flags,
      lrc_coverage_ms: this.lrc_coverage_ms,
      lrc_has_word_timestamps: this.lrc_has_word_timestamps,
      lrc_last_synced_at: this.lrc_last_synced_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
