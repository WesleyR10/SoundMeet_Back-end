import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import {
  SyncedLyrics,
  SyncedLyricsId,
} from "../../../domain/synced-lyrics.aggregate";
import { SyncedLyricsModel } from "./synced-lyrics-model";

export type SyncedLyricsModelProps = {
  lrc_raw?: string | null;
  lrc_normalized?: any;
  lrc_provider?: string | null;
  lrc_provider_meta?: any;
  lrc_hash?: string | null;
  lrc_version?: number;
  lrc_pipeline_version?: number;
  lrc_quality_flags?: string[];
  lrc_coverage_ms?: number | null;
  lrc_has_word_timestamps?: boolean;
  lrc_last_synced_at?: Date | null;
  updated_at?: Date;
};

export class SyncedLyricsModelMapper {
  static toModel(entity: SyncedLyrics): SyncedLyricsModelProps {
    const model = {
      lrc_raw: entity.lrc_raw,
      lrc_normalized: entity.lrc_normalized as any,
      lrc_provider: entity.lrc_provider,
      lrc_provider_meta: entity.lrc_provider_meta as any,
      lrc_hash: entity.lrc_hash,
      lrc_version: entity.lrc_version,
      lrc_pipeline_version: entity.lrc_pipeline_version,
      lrc_quality_flags: entity.lrc_quality_flags,
      lrc_coverage_ms: entity.lrc_coverage_ms,
      lrc_has_word_timestamps: entity.lrc_has_word_timestamps,
      lrc_last_synced_at: entity.lrc_last_synced_at,
      updated_at: entity.updated_at,
    };

    Object.keys(model).forEach((key) => {
      if (model[key as keyof typeof model] === undefined) {
        delete model[key as keyof typeof model];
      }
    });

    return model;
  }

  static toEntity(model: SyncedLyricsModel): SyncedLyrics {
    const entity = new SyncedLyrics({
      synced_lyrics_id: new SyncedLyricsId(model.id),
      music_library_id: new SyncedLyricsId(model.id),
      musician_id: new Uuid(model.musicianId),
      title: model.title,
      artist: model.artist,
      lrc_raw: model.lrc_raw ?? null,
      lrc_provider: model.lrc_provider ?? null,
      lrc_provider_meta: (model.lrc_provider_meta as any) ?? null,
      lrc_hash: model.lrc_hash ?? null,
      lrc_version: model.lrc_version ?? 1,
      lrc_pipeline_version: model.lrc_pipeline_version ?? 1,
      lrc_normalized: (model.lrc_normalized as any) ?? null,
      lrc_quality_flags: model.lrc_quality_flags ?? [],
      lrc_coverage_ms: model.lrc_coverage_ms ?? null,
      lrc_has_word_timestamps: model.lrc_has_word_timestamps ?? false,
      lrc_last_synced_at: model.lrc_last_synced_at ?? null,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    entity.validate();
    if (entity.notification.hasErrors()) {
      throw new LoadEntityError(entity.notification.toJSON());
    }

    return entity;
  }
}
