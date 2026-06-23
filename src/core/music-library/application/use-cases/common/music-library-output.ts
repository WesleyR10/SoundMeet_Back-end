import {
  ChordsData,
  ChordSheetData,
  LrcNormalizedData,
  LrcProviderMeta,
  MusicLibrary,
  RenderableChordSheetData,
  StructureSegments,
} from "../../../domain/music-library.aggregate";

export type MusicLibraryOutput = {
  id: string;
  musician_id: string;
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
  source: string | null;
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
  created_at: Date;
  updated_at: Date;
  display_name: string;
  has_lyrics: boolean;
  has_chord_sheet: boolean;
  has_lrc: boolean;
  is_hard: boolean;
};

export class MusicLibraryOutputMapper {
  static toOutput(entity: MusicLibrary): MusicLibraryOutput {
    return {
      id: entity.music_library_id.id,
      musician_id: entity.musician_id.id,
      title: entity.title,
      artist: entity.artist,
      genre: entity.genre,
      key: entity.key,
      bpm: entity.bpm,
      lyrics: entity.lyrics,
      chords: entity.chords,
      structure_segments: entity.structure_segments,
      chord_sheet: entity.chord_sheet,
      chord_sheet_version: entity.chord_sheet_version,
      renderable_chord_sheet: entity.renderable_chord_sheet,
      renderable_chord_sheet_version: entity.renderable_chord_sheet_version,
      notes: entity.notes,
      difficulty: entity.difficulty,
      is_favorite: entity.is_favorite,
      source: entity.source,
      source_id: entity.source_id,
      lrc_raw: entity.lrc_raw,
      lrc_normalized: entity.lrc_normalized,
      lrc_provider: entity.lrc_provider,
      lrc_provider_meta: entity.lrc_provider_meta,
      lrc_hash: entity.lrc_hash,
      lrc_version: entity.lrc_version,
      lrc_pipeline_version: entity.lrc_pipeline_version,
      lrc_quality_flags: entity.lrc_quality_flags,
      lrc_coverage_ms: entity.lrc_coverage_ms,
      lrc_has_word_timestamps: entity.lrc_has_word_timestamps,
      lrc_last_synced_at: entity.lrc_last_synced_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      display_name: entity.displayName,
      has_lyrics: entity.hasLyrics,
      has_chord_sheet: entity.hasChordSheet,
      has_lrc: entity.hasLrc,
      is_hard: entity.isHard,
    };
  }
}
