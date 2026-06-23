import { IsOptional, validateSync } from "class-validator";

import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { MusicLibraryFilter } from "../../../domain/music-library.repository";

export type ListMusicLibraryInputConstructorProps = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: MusicLibraryFilter | null;
};

export class ListMusicLibraryInput {
  @IsOptional()
  page?: number;

  @IsOptional()
  per_page?: number;

  @IsOptional()
  sort?: string | null;

  @IsOptional()
  sort_dir?: SortDirection | null;

  @IsOptional()
  filter?: MusicLibraryFilter | null;

  constructor(props: ListMusicLibraryInputConstructorProps = {}) {
    this.page = props.page;
    this.per_page = props.per_page;
    this.sort = props.sort;
    this.sort_dir = props.sort_dir;
    this.filter = props.filter;
  }
}

export class ValidateListMusicLibraryInput {
  static validate(input: ListMusicLibraryInput) {
    return validateSync(input);
  }
}
