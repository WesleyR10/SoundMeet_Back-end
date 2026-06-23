import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

import { MusicLibraryOutput } from "../../core/music-library/application/use-cases/common/music-library-output";
import { ListMusicLibraryOutput } from "../../core/music-library/application/use-cases/list-music-library/list-music-library.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class MusicLibraryPresenter {
  id: string;
  musician_id: string;
  title: string;
  artist: string;
  genre: string | null;
  key: string | null;
  bpm: number | null;
  lyrics: string | null;
  notes: string | null;
  difficulty: number;
  is_favorite: boolean;
  source: string | null;
  source_id: string | null;
  chord_sheet_version: number;
  renderable_chord_sheet_version: number;
  lrc_version: number;
  lrc_provider: string | null;
  lrc_hash: string | null;
  lrc_quality_flags: string[];
  display_name: string;
  has_lyrics: boolean;
  has_chord_sheet: boolean;
  has_lrc: boolean;
  is_hard: boolean;

  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;

  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: MusicLibraryOutput) {
    this.id = output.id;
    this.musician_id = output.musician_id;
    this.title = output.title;
    this.artist = output.artist;
    this.genre = output.genre;
    this.key = output.key;
    this.bpm = output.bpm;
    this.lyrics = output.lyrics;
    this.notes = output.notes;
    this.difficulty = output.difficulty;
    this.is_favorite = output.is_favorite;
    this.source = output.source;
    this.source_id = output.source_id;
    this.chord_sheet_version = output.chord_sheet_version;
    this.renderable_chord_sheet_version = output.renderable_chord_sheet_version;
    this.lrc_version = output.lrc_version;
    this.lrc_provider = output.lrc_provider;
    this.lrc_hash = output.lrc_hash;
    this.lrc_quality_flags = output.lrc_quality_flags;
    this.display_name = output.display_name;
    this.has_lyrics = output.has_lyrics;
    this.has_chord_sheet = output.has_chord_sheet;
    this.has_lrc = output.has_lrc;
    this.is_hard = output.is_hard;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class MusicLibraryCollectionPresenter extends CollectionPresenter {
  @ApiProperty({ type: () => [MusicLibraryPresenter] })
  data: MusicLibraryPresenter[];

  constructor(output: ListMusicLibraryOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((item) => new MusicLibraryPresenter(item));
  }
}
