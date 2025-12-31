import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from "class-validator";

import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { BadgeCategory, BadgeRarity } from "../../../domain/badge.aggregate";
import { BadgeFilter } from "../../../domain/badge.repository";

export type ListBadgesInputConstructorProps = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: BadgeFilter | null;
  category?: BadgeCategory | null;
  rarity?: BadgeRarity | null;
  is_active?: boolean | null;
};

export class ListBadgesInput {
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
  sort?: string | null;

  @IsOptional()
  sort_dir?: SortDirection | null;

  @IsOptional()
  filter?: BadgeFilter | null;

  @IsOptional()
  category?: BadgeCategory | null;

  @IsOptional()
  rarity?: BadgeRarity | null;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean | null;

  constructor(props?: ListBadgesInputConstructorProps) {
    if (!props) return;
    this.page = props.page;
    this.per_page = props.per_page;
    this.sort = props.sort;
    this.sort_dir = props.sort_dir;
    this.filter = props.filter;
    this.category = props.category;
    this.rarity = props.rarity;
    this.is_active = props.is_active;
  }
}

export class ValidateListBadgesInput {
  static validate(input: ListBadgesInput) {
    return validateSync(input);
  }
}
