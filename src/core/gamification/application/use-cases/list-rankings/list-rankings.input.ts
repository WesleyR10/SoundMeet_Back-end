import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from "class-validator";

export type ListRankingsInputConstructorProps = {
  page?: number;
  per_page?: number;
  sort?: string;
  sort_dir?: "asc" | "desc";
  filter?: {
    ranking_type?: string;
    period?: string;
  };
};

export class ListRankingsInput {
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  per_page?: number;

  @IsString()
  @IsOptional()
  sort?: string;

  @IsString()
  @IsOptional()
  sort_dir?: "asc" | "desc";

  @IsOptional()
  filter?: {
    ranking_type?: string;
    period?: string;
  };

  constructor(props: ListRankingsInputConstructorProps = {}) {
    if (!props) return;
    this.page = props.page;
    this.per_page = props.per_page;
    this.sort = props.sort;
    this.sort_dir = props.sort_dir;
    this.filter = props.filter;
  }
}

export class ValidateListRankingsInput {
  static validate(input: ListRankingsInput) {
    return validateSync(input);
  }
}
