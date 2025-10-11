import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
  IsIn,
} from "class-validator";
import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Badge, BadgeCategory, BadgeRarity } from "./badge.aggregate";

export class BadgeRules {
  @MaxLength(255, { groups: ["name"] })
  @IsNotEmpty({ groups: ["name"] })
  @IsString({ groups: ["name"] })
  name: string;

  @MaxLength(1000, { groups: ["description"] })
  @IsNotEmpty({ groups: ["description"] })
  @IsString({ groups: ["description"] })
  description: string;

  @MaxLength(500, { groups: ["icon"] })
  @IsNotEmpty({ groups: ["icon"] })
  @IsString({ groups: ["icon"] })
  icon: string;

  @IsIn(["engagement", "support", "discovery", "social"], {
    groups: ["category"],
  })
  @IsNotEmpty({ groups: ["category"] })
  @IsString({ groups: ["category"] })
  category: BadgeCategory;

  @IsObject({ groups: ["requirement"] })
  @IsNotEmpty({ groups: ["requirement"] })
  requirement: Record<string, any>;

  @Min(0, { groups: ["points"] })
  @IsNumber({}, { groups: ["points"] })
  @IsOptional({ groups: ["points"] })
  points?: number;

  @IsIn(["common", "rare", "epic", "legendary"], { groups: ["rarity"] })
  @IsOptional({ groups: ["rarity"] })
  @IsString({ groups: ["rarity"] })
  rarity?: BadgeRarity;

  @IsBoolean({ groups: ["is_active"] })
  @IsOptional({ groups: ["is_active"] })
  is_active?: boolean;

  constructor(entity: Badge | any) {
    this.name = entity?.name;
    this.description = entity?.description;
    this.icon = entity?.icon;
    this.category = entity?.category;
    this.requirement = entity?.requirement;
    this.points = entity?.points;
    this.rarity = entity?.rarity;
    this.is_active = entity?.is_active;
  }
}

export class BadgeValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["name", "description", "icon", "category", "requirement"];
    return super.validate(notification, new BadgeRules(data), newFields);
  }
}

export class BadgeValidatorFactory {
  static create(): BadgeValidator {
    return new BadgeValidator();
  }
}
