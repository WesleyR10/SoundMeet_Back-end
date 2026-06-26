import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import {
  ChordsData,
  ChordSheetData,
  LrcNormalizedData,
  LrcProviderMeta,
  MusicLibrary,
  MusicLibraryId,
  RenderableChordSheetData,
  StructureSegments,
} from "../../../domain/music-library.aggregate";
import { JsonValue, MusicLibraryModel } from "./music-library-model";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

export class MusicLibraryModelMapper {
  static toModel(entity: MusicLibrary): MusicLibraryModel {
    return {
      id: entity.music_library_id.id,
      musicianId: entity.musician_id.id,
      title: entity.title,
      artist: entity.artist,
      genre: entity.genre ?? null,
      key: entity.key ?? null,
      bpm: entity.bpm ?? null,
      lyrics: entity.lyrics ?? null,
      chords: (entity.chords ?? null) as JsonValue | null,
      structure_segments: (entity.structure_segments ??
        null) as JsonValue | null,
      chord_sheet: (entity.chord_sheet ?? null) as JsonValue | null,
      chord_sheet_version: entity.chord_sheet_version,
      renderable_chord_sheet: (entity.renderable_chord_sheet ??
        null) as JsonValue | null,
      renderable_chord_sheet_version: entity.renderable_chord_sheet_version,
      notes: entity.notes ?? null,
      difficulty: entity.difficulty,
      isFavorite: entity.is_favorite,
      source: entity.source ?? null,
      sourceId: entity.source_id ?? null,
      lrc_raw: entity.lrc_raw ?? null,
      lrc_normalized: (entity.lrc_normalized ?? null) as JsonValue | null,
      lrc_provider: entity.lrc_provider ?? null,
      lrc_provider_meta: (entity.lrc_provider_meta ?? null) as JsonValue | null,
      lrc_hash: entity.lrc_hash ?? null,
      lrc_version: entity.lrc_version,
      lrc_pipeline_version: entity.lrc_pipeline_version,
      lrc_quality_flags: entity.lrc_quality_flags ?? [],
      lrc_coverage_ms: entity.lrc_coverage_ms ?? null,
      lrc_has_word_timestamps: entity.lrc_has_word_timestamps,
      lrc_last_synced_at: entity.lrc_last_synced_at ?? null,
      duration_seconds: entity.duration_seconds ?? null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: MusicLibraryModel): MusicLibrary {
    const entity = new MusicLibrary({
      music_library_id: new MusicLibraryId(model.id),
      musician_id: new Uuid(model.musicianId),
      title: model.title,
      artist: model.artist,
      genre: model.genre ?? null,
      key: model.key ?? null,
      bpm: model.bpm ?? null,
      lyrics: model.lyrics ?? null,
      chords: (model.chords ?? null) as ChordsData | null,
      structure_segments: (model.structure_segments ??
        null) as StructureSegments | null,
      chord_sheet: (model.chord_sheet ?? null) as ChordSheetData | null,
      chord_sheet_version: model.chord_sheet_version,
      renderable_chord_sheet: (model.renderable_chord_sheet ??
        null) as RenderableChordSheetData | null,
      renderable_chord_sheet_version: model.renderable_chord_sheet_version,
      notes: model.notes ?? null,
      difficulty: model.difficulty,
      is_favorite: model.isFavorite,
      source: model.source ?? null,
      source_id: model.sourceId ?? null,
      lrc_raw: model.lrc_raw ?? null,
      lrc_normalized: (model.lrc_normalized ??
        null) as LrcNormalizedData | null,
      lrc_provider: model.lrc_provider ?? null,
      lrc_provider_meta: (isRecord(model.lrc_provider_meta)
        ? model.lrc_provider_meta
        : null) as LrcProviderMeta | null,
      lrc_hash: model.lrc_hash ?? null,
      lrc_version: model.lrc_version,
      lrc_pipeline_version: model.lrc_pipeline_version,
      lrc_quality_flags: model.lrc_quality_flags ?? [],
      lrc_coverage_ms: model.lrc_coverage_ms ?? null,
      lrc_has_word_timestamps: model.lrc_has_word_timestamps,
      lrc_last_synced_at: model.lrc_last_synced_at ?? null,
      duration_seconds: model.duration_seconds ?? null,
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
