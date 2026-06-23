export type MusicLibraryRenderableChordSheetReadModel = {
  id: string;
  musicianId: string;
  title: string;
  artist: string;
  renderable_chord_sheet: unknown | null;
  renderable_chord_sheet_version: number;
  updated_at: Date;
};

export interface IRenderableChordSheetReadModel {
  getMusicLibraryById(
    id: string,
  ): Promise<MusicLibraryRenderableChordSheetReadModel | null>;
}
