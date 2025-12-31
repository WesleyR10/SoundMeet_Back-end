import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from "class-validator";

import { BadgeCategory, BadgeRarity } from "../../../domain/badge.aggregate";

export type UpdateBadgeInputConstructorProps = {
  id: string;
  name?: string;
  description?: string;
  icon?: string;
  category?: BadgeCategory;
  requirement?: Record<string, any>;
  points?: number;
  rarity?: BadgeRarity;
  is_active?: boolean;
};

export class UpdateBadgeInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsIn(["engagement", "support", "discovery", "social"])
  @IsOptional()
  category?: BadgeCategory;

  @IsObject()
  @IsOptional()
  requirement?: Record<string, any>;

  @IsNumber()
  @Min(0)
  @IsOptional()
  points?: number;

  @IsIn(["common", "rare", "epic", "legendary"])
  @IsOptional()
  rarity?: BadgeRarity;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  constructor(props: UpdateBadgeInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.icon = props.icon;
    this.category = props.category;
    this.requirement = props.requirement;
    this.points = props.points;
    this.rarity = props.rarity;
    this.is_active = props.is_active;
  }
}

export class ValidateUpdateBadgeInput {
  static validate(input: UpdateBadgeInput) {
    return validateSync(input);
  }
}
