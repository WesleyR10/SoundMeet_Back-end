import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
  Max,
} from "class-validator";
import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Musician } from "./musician.aggregate";

export class MusicianRules {
  @MaxLength(255, { groups: ["name"] })
  @IsNotEmpty({ groups: ["name"] })
  @IsString({ groups: ["name"] })
  name: string;

  @MaxLength(255, { groups: ["stage_name"] })
  @IsOptional({ groups: ["stage_name"] })
  @IsString({ groups: ["stage_name"] })
  stage_name?: string;

  @IsEmail({}, { groups: ["email"] })
  @IsNotEmpty({ groups: ["email"] })
  email: string;

  @MaxLength(1000, { groups: ["bio"] })
  @IsOptional({ groups: ["bio"] })
  @IsString({ groups: ["bio"] })
  bio?: string;

  @MaxLength(500, { groups: ["avatar"] })
  @IsOptional({ groups: ["avatar"] })
  @IsString({ groups: ["avatar"] })
  avatar?: string;

  @MaxLength(20, { groups: ["phone"] })
  @IsOptional({ groups: ["phone"] })
  @IsString({ groups: ["phone"] })
  phone?: string;

  @IsArray({ groups: ["genres"] })
  @IsOptional({ groups: ["genres"] })
  genres?: string[];

  @IsArray({ groups: ["instruments"] })
  @IsOptional({ groups: ["instruments"] })
  instruments?: string[];

  @Min(0, { groups: ["experience_years"] })
  @Max(100, { groups: ["experience_years"] })
  @IsOptional({ groups: ["experience_years"] })
  @IsNumber({}, { groups: ["experience_years"] })
  experience_years?: number;

  @IsBoolean({ groups: ["is_active"] })
  @IsOptional({ groups: ["is_active"] })
  is_active?: boolean;

  @IsBoolean({ groups: ["is_verified"] })
  @IsOptional({ groups: ["is_verified"] })
  is_verified?: boolean;

  constructor(entity: Musician | any) {
    this.name = entity?.name;
    this.stage_name = entity?.stage_name;
    this.email = entity?.email?.value || entity?.email;
    this.bio = entity?.bio;
    this.avatar = entity?.avatar;
    this.phone = entity?.phone?.value || entity?.phone;
    this.genres = entity?.genres;
    this.instruments = entity?.instruments;
    this.experience_years = entity?.experience_years;
    this.is_active = entity?.is_active;
    this.is_verified = entity?.is_verified;
  }
}

export class MusicianValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length ? fields : ["name", "email"];
    return super.validate(notification, new MusicianRules(data), newFields);
  }
}

export class MusicianValidatorFactory {
  static create(): MusicianValidator {
    return new MusicianValidator();
  }
}
