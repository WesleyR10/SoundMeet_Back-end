export type UpsertRenderableChordSheetForMusicLibraryInput = {
  music_library_id: string;
  musician_id: string;
  renderable_chord_sheet: unknown | null;
  force?: boolean;
};

export type UpsertRenderableChordSheetForMusicLibraryOutput = {
  updated: boolean;
  skipped?: boolean;
};

export interface IRenderableChordSheetWriteModel {
  upsertRenderableChordSheetForMusicLibrary(
    input: UpsertRenderableChordSheetForMusicLibraryInput,
  ): Promise<UpsertRenderableChordSheetForMusicLibraryOutput>;
}
