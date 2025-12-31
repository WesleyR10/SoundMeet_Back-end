import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from "class-validator";

export type ListUserScoresInputConstructorProps = {
  page?: number;
  per_page?: number;
  sort?: string;
  sort_dir?: "asc" | "desc";
  filter?: {
    user_id?: string;
    score_type?: string;
  };
};

export class ListUserScoresInput {
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
    user_id?: string;
    score_type?: string;
  };

  constructor(props: ListUserScoresInputConstructorProps = {}) {
    if (!props) return;
    this.page = props.page;
    this.per_page = props.per_page;
    this.sort = props.sort;
    this.sort_dir = props.sort_dir;
    this.filter = props.filter;
  }
}

export class ValidateListUserScoresInput {
  static validate(input: ListUserScoresInput) {
    return validateSync(input);
  }
}
