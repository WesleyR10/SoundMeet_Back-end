import { SyncedLyrics } from "../../../domain/synced-lyrics.aggregate";

export type SyncedLyricsOutput = {
  music_library_id: string;
  musician_id: string;
  title: string;
  artist: string;
  lrc_raw?: string | null;
  lrc_provider: string | null;
  lrc_provider_meta: Record<string, unknown> | null;
  lrc_hash: string | null;
  lrc_version: number;
  lrc_pipeline_version: number;
  lrc_normalized: any;
  lrc_quality_flags: string[];
  lrc_coverage_ms: number | null;
  lrc_has_word_timestamps: boolean;
  lrc_last_synced_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class SyncedLyricsOutputMapper {
  static toOutput(
    entity: SyncedLyrics,
    options?: { include_raw?: boolean },
  ): SyncedLyricsOutput {
    return {
      music_library_id: entity.music_library_id.id,
      musician_id: entity.musician_id.id,
      title: entity.title,
      artist: entity.artist,
      ...(options?.include_raw ? { lrc_raw: entity.lrc_raw } : {}),
      lrc_provider: entity.lrc_provider,
      lrc_provider_meta: entity.lrc_provider_meta,
      lrc_hash: entity.lrc_hash,
      lrc_version: entity.lrc_version,
      lrc_pipeline_version: entity.lrc_pipeline_version,
      lrc_normalized: entity.lrc_normalized,
      lrc_quality_flags: entity.lrc_quality_flags,
      lrc_coverage_ms: entity.lrc_coverage_ms,
      lrc_has_word_timestamps: entity.lrc_has_word_timestamps,
      lrc_last_synced_at: entity.lrc_last_synced_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
