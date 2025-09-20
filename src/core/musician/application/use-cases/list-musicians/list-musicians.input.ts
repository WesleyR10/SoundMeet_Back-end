import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { MusicianFilter } from "../../../domain/musician.repository";
import { IsOptional, validateSync } from "class-validator";

export type ListMusiciansInputConstructorProps = {
  page?: number;
  per_page?: number;
  sort?: string;
  sort_dir?: SortDirection;
  filter?: MusicianFilter;
};

export class ListMusiciansInput {
  @IsOptional()
  page?: number;

  @IsOptional()
  per_page?: number;

  @IsOptional()
  sort?: string;

  @IsOptional()
  sort_dir?: SortDirection;

  @IsOptional()
  filter?: MusicianFilter;

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
