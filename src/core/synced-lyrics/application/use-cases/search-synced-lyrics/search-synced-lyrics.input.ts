import { Type } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  validateSync,
} from "class-validator";

import { SortDirection } from "../../../../shared/domain/repository/search-params";

export type SearchSyncedLyricsInputConstructorProps = {
  musician_id: string;
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  query?: string | null;
  has_lrc?: boolean | null;
  provider?: string | null;
  hash?: string | null;
  include_raw?: boolean;
};

export class SearchSyncedLyricsInput {
  @IsUUID()
  musician_id: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  per_page?: number;

  @IsOptional()
  @IsString()
  sort?: string | null;

  @IsOptional()
  @IsEnum(["asc", "desc"])
  sort_dir?: SortDirection | null;

  @IsOptional()
  @IsString()
  query?: string | null;

  @IsOptional()
  has_lrc?: boolean | null;

  @IsOptional()
  @IsString()
  provider?: string | null;

  @IsOptional()
  @IsString()
  hash?: string | null;

  @IsOptional()
  include_raw?: boolean;

  constructor(props: SearchSyncedLyricsInputConstructorProps = {} as any) {
    if (!props) return;
    this.musician_id = props.musician_id;
    this.page = props.page;
    this.per_page = props.per_page;
    this.sort = props.sort;
    this.sort_dir = props.sort_dir;
    this.query = props.query;
    this.has_lrc = props.has_lrc;
    this.provider = props.provider;
    this.hash = props.hash;
    this.include_raw = props.include_raw;
  }
}

export class ValidateSearchSyncedLyricsInput {
  static validate(input: SearchSyncedLyricsInput) {
    return validateSync(input);
  }
}
