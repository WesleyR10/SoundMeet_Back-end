export type MusicLibraryChordSheetReadModel = {
  id: string;
  musicianId: string;
  title: string;
  artist: string;
  bpm: number | null;
  key: string | null;
  chords: unknown | null;
  structure_segments: unknown | null;
  lrc_provider: string | null;
  lrc_provider_meta: Record<string, unknown> | null;
  lrc_pipeline_version: number;
  lrc_version: number;
  lrc_quality_flags: string[];
  lrc_normalized: unknown | null;
  updated_at: Date;
};

export interface IChordSheetReadModel {
  getMusicLibraryById(
    id: string,
  ): Promise<MusicLibraryChordSheetReadModel | null>;
}
