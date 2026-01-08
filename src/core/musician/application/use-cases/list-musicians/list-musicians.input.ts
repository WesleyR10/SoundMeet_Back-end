import { IsOptional, validateSync } from "class-validator";

import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { MusicianFilter } from "../../../domain/musician.repository";

export type ListMusiciansInputConstructorProps = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: MusicianFilter | null;
};

export class ListMusiciansInput {
  @IsOptional()
  page?: number;

  @IsOptional()
  per_page?: number;

  @IsOptional()
  sort?: string | null;

  @IsOptional()
  sort_dir?: SortDirection | null;

  @IsOptional()
  filter?: MusicianFilter | null;

  constructor(props: ListMusiciansInputConstructorProps = {}) {
    this.page = props.page;
    this.per_page = props.per_page;
    this.sort = props.sort;
    this.sort_dir = props.sort_dir;
    this.filter = props.filter;
  }
}

export class ValidateListMusiciansInput {
  static validate(input: ListMusiciansInput) {
    return validateSync(input);
  }
}
