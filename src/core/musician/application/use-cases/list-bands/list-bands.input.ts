import { IsOptional, validateSync } from "class-validator";

import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { BandFilter } from "../../../domain/band.repository";

export type ListBandsInputConstructorProps = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: BandFilter | null;
};

export class ListBandsInput {
  @IsOptional()
  page?: number;

  @IsOptional()
  per_page?: number;

  @IsOptional()
  sort?: string | null;

  @IsOptional()
  sort_dir?: SortDirection | null;

  @IsOptional()
  filter?: BandFilter | null;

  constructor(props: ListBandsInputConstructorProps = {}) {
    this.page = props.page;
    this.per_page = props.per_page;
    this.sort = props.sort;
    this.sort_dir = props.sort_dir;
    this.filter = props.filter;
  }
}

export class ValidateListBandsInput {
  static validate(input: ListBandsInput) {
    return validateSync(input);
  }
}
