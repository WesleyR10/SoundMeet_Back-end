import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { SyncedLyrics } from "./synced-lyrics.aggregate";

export class SyncedLyricsRules {
  @IsNotEmpty({ groups: ["music_library_id"] })
  @IsString({ groups: ["music_library_id"] })
  music_library_id: string;

  @IsNotEmpty({ groups: ["musician_id"] })
  @IsString({ groups: ["musician_id"] })
  musician_id: string;

  @MaxLength(255, { groups: ["title"] })
  @IsNotEmpty({ groups: ["title"] })
  @IsString({ groups: ["title"] })
  title: string;

  @MaxLength(255, { groups: ["artist"] })
  @IsNotEmpty({ groups: ["artist"] })
  @IsString({ groups: ["artist"] })
  artist: string;

  @IsOptional({ groups: ["lrc_raw"] })
  @IsString({ groups: ["lrc_raw"] })
  lrc_raw?: string | null;

  @IsOptional({ groups: ["lrc_provider"] })
  @MaxLength(64, { groups: ["lrc_provider"] })
  @IsString({ groups: ["lrc_provider"] })
  lrc_provider?: string | null;

  @IsOptional({ groups: ["lrc_provider_meta"] })
  @IsObject({ groups: ["lrc_provider_meta"] })
  lrc_provider_meta?: Record<string, unknown> | null;

  @IsOptional({ groups: ["lrc_hash"] })
  @MaxLength(128, { groups: ["lrc_hash"] })
  @IsString({ groups: ["lrc_hash"] })
  lrc_hash?: string | null;

  @IsInt({ groups: ["lrc_version"] })
  @Min(1, { groups: ["lrc_version"] })
  lrc_version: number;

  @IsInt({ groups: ["lrc_pipeline_version"] })
  @Min(1, { groups: ["lrc_pipeline_version"] })
  lrc_pipeline_version: number;

  @IsOptional({ groups: ["lrc_normalized"] })
  @IsObject({ groups: ["lrc_normalized"] })
  lrc_normalized?: any;

  @IsArray({ groups: ["lrc_quality_flags"] })
  lrc_quality_flags: string[];

  @IsOptional({ groups: ["lrc_coverage_ms"] })
  @IsInt({ groups: ["lrc_coverage_ms"] })
  lrc_coverage_ms?: number | null;

  @IsBoolean({ groups: ["lrc_has_word_timestamps"] })
  lrc_has_word_timestamps: boolean;

  constructor(entity: SyncedLyrics | any) {
    Object.assign(this, {
      music_library_id: entity.music_library_id?.id ?? entity.music_library_id,
      musician_id: entity.musician_id?.id ?? entity.musician_id,
      title: entity.title,
      artist: entity.artist,
      lrc_raw: entity.lrc_raw,
      lrc_provider: entity.lrc_provider,
      lrc_provider_meta: entity.lrc_provider_meta,
      lrc_hash: entity.lrc_hash,
      lrc_version: entity.lrc_version,
      lrc_pipeline_version: entity.lrc_pipeline_version,
      lrc_normalized: entity.lrc_normalized,
      lrc_quality_flags: entity.lrc_quality_flags,
      lrc_coverage_ms: entity.lrc_coverage_ms,
      lrc_has_word_timestamps: entity.lrc_has_word_timestamps,
    });
  }
}

export class SyncedLyricsValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "music_library_id",
          "musician_id",
          "title",
          "artist",
          "lrc_raw",
          "lrc_provider",
          "lrc_provider_meta",
          "lrc_hash",
          "lrc_version",
          "lrc_pipeline_version",
          "lrc_normalized",
          "lrc_quality_flags",
          "lrc_coverage_ms",
          "lrc_has_word_timestamps",
        ];
    return super.validate(notification, new SyncedLyricsRules(data), newFields);
  }
}

export class SyncedLyricsValidatorFactory {
  static create(): SyncedLyricsValidator {
    return new SyncedLyricsValidator();
  }
}
