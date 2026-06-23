export type UpsertChordSheetForMusicLibraryInput = {
  music_library_id: string;
  musician_id: string;
  chord_sheet: unknown | null;
  force?: boolean;
};

export type UpsertChordSheetForMusicLibraryOutput = {
  updated: boolean;
  skipped?: boolean;
};

export interface IChordSheetWriteModel {
  upsertChordSheetForMusicLibrary(
    input: UpsertChordSheetForMusicLibraryInput,
  ): Promise<UpsertChordSheetForMusicLibraryOutput>;
}
