import {
  BadgeCategory,
  BadgeRarity,
} from "@core/gamification/domain/badge.aggregate";
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

export type CreateBadgeInputConstructorProps = {
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  requirement: Record<string, any>;
  points?: number;
  rarity?: BadgeRarity;
  is_active?: boolean;
};

export class CreateBadgeInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  icon: string;

  @IsIn(["engagement", "support", "discovery", "social"])
  @IsNotEmpty()
  category: BadgeCategory;

  @IsObject()
  @IsNotEmpty()
  requirement: Record<string, any>;

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

  constructor(props: CreateBadgeInputConstructorProps) {
    if (!props) return;
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

export class ValidateCreateBadgeInput {
  static validate(input: CreateBadgeInput) {
    return validateSync(input);
  }
}
