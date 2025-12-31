import { IsOptional, validateSync } from "class-validator";

import { SortDirection } from "../../../../shared/domain/repository/search-params";

export type RecommendMusiciansInput = {
  audience_id: string;
  page?: number;
  per_page?: number;
  sort?: "rating" | "created_at";
  sort_dir?: SortDirection | null;
  only_active?: boolean;
};

export class RecommendMusiciansQueryInput {
  @IsOptional()
  page?: number;

  @IsOptional()
  per_page?: number;

  @IsOptional()
  sort?: "rating" | "created_at";

  @IsOptional()
  sort_dir?: SortDirection | null;

  @IsOptional()
  only_active?: boolean;

  constructor(
    props: Partial<Omit<RecommendMusiciansInput, "audience_id">> = {},
  ) {
    this.page = props.page;
    this.per_page = props.per_page;
    this.sort = props.sort;
    this.sort_dir = props.sort_dir ?? null;
    this.only_active = props.only_active;
  }
}

export class ValidateRecommendMusiciansInput {
  static validate(input: RecommendMusiciansQueryInput) {
    return validateSync(input);
  }
}
