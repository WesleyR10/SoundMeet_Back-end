import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from "class-validator";

export type ListUserInteractionsInputConstructorProps = {
  page?: number;
  per_page?: number;
  sort?: string;
  sort_dir?: "asc" | "desc";
  filter?: {
    user_id?: string;
    interaction_type?: string;
    target_id?: string;
    points_earned?: number;
  };
};

export class ListUserInteractionsInput {
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
    interaction_type?: string;
    target_id?: string;
    points_earned?: number;
  };

  constructor(props: ListUserInteractionsInputConstructorProps = {}) {
    if (!props) return;
    this.page = props.page;
    this.per_page = props.per_page;
    this.sort = props.sort;
    this.sort_dir = props.sort_dir;
    this.filter = props.filter;
  }
}

export class ValidateListUserInteractionsInput {
  static validate(input: ListUserInteractionsInput) {
    return validateSync(input);
  }
}
