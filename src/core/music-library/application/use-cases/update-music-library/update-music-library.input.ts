import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from "class-validator";

import {
  ChordsData,
  ChordSheetData,
  RenderableChordSheetData,
  StructureSegments,
} from "../../../domain/music-library.aggregate";

export type UpdateMusicLibraryInputConstructorProps = {
  id: string;
  title?: string;
  artist?: string;
  genre?: string | null;
  key?: string | null;
  bpm?: number | null;
  lyrics?: string | null;
  chords?: ChordsData | null;
  structure_segments?: StructureSegments | null;
  chord_sheet?: ChordSheetData | null;
  renderable_chord_sheet?: RenderableChordSheetData | null;
  notes?: string | null;
  difficulty?: number;
  is_favorite?: boolean;
  source?: string | null;
  source_id?: string | null;
};

export class UpdateMusicLibraryInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  artist?: string;

  @IsString()
  @IsOptional()
  genre?: string | null;

  @IsString()
  @IsOptional()
  key?: string | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bpm?: number | null;

  @IsString()
  @IsOptional()
  lyrics?: string | null;

  @IsOptional()
  chords?: ChordsData | null;

  @IsOptional()
  structure_segments?: StructureSegments | null;

  @IsOptional()
  chord_sheet?: ChordSheetData | null;

  @IsOptional()
  renderable_chord_sheet?: RenderableChordSheetData | null;

  @IsString()
  @IsOptional()
  notes?: string | null;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  difficulty?: number;

  @IsBoolean()
  @IsOptional()
  is_favorite?: boolean;

  @IsString()
  @IsOptional()
  source?: string | null;

  @IsString()
  @IsOptional()
  source_id?: string | null;

  constructor(props: UpdateMusicLibraryInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.title = props.title;
    this.artist = props.artist;
    this.genre = props.genre;
    this.key = props.key;
    this.bpm = props.bpm;
    this.lyrics = props.lyrics;
    this.chords = props.chords;
    this.structure_segments = props.structure_segments;
    this.chord_sheet = props.chord_sheet;
    this.renderable_chord_sheet = props.renderable_chord_sheet;
    this.notes = props.notes;
    this.difficulty = props.difficulty;
    this.is_favorite = props.is_favorite;
    this.source = props.source;
    this.source_id = props.source_id;
  }
}

export class ValidateUpdateMusicLibraryInput {
  static validate(input: UpdateMusicLibraryInput) {
    return validateSync(input);
  }
}
