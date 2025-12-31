import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Audience } from "./audience.aggregate";

export class AudienceRules {
  @MaxLength(255, { groups: ["name"] })
  @IsNotEmpty({ groups: ["name"] })
  @IsString({ groups: ["name"] })
  @MinLength(2, { groups: ["name"] })
  name: string;

  @IsEmail({}, { groups: ["email"], message: "email must be a valid email" })
  @IsNotEmpty({ groups: ["email"] })
  email: string;

  @IsOptional({ groups: ["phone"] })
  @Matches(/^[\d+\-\s\(\)]+$/, {
    groups: ["phone"],
    message: "phone must be a valid phone format",
  })
  phone?: string;

  @IsOptional({ groups: ["nickname"] })
  @IsString({ groups: ["nickname"] })
  @MaxLength(50, { groups: ["nickname"] })
  @MinLength(2, { groups: ["nickname"] })
  nickname?: string;

  @IsOptional({ groups: ["avatar"] })
  @IsString({ groups: ["avatar"] })
  avatar?: string;

  @IsBoolean({ groups: ["is_active"] })
  @IsOptional({ groups: ["is_active"] })
  is_active?: boolean;

  @IsOptional({ groups: ["favorite_genres"] })
  @IsArray({ groups: ["favorite_genres"] })
  @ArrayMaxSize(20, { groups: ["favorite_genres"] })
  favorite_genres?: string[];

  @IsOptional({ groups: ["favorite_artists"] })
  @IsArray({ groups: ["favorite_artists"] })
  @ArrayMaxSize(20, { groups: ["favorite_artists"] })
  favorite_artists?: string[];

  @IsOptional({ groups: ["favorite_instruments"] })
  @IsArray({ groups: ["favorite_instruments"] })
  @ArrayMaxSize(15, { groups: ["favorite_instruments"] })
  favorite_instruments?: string[];

  constructor(entity: Audience) {
    Object.assign(this, entity);
    // Se o email for um objeto Email, extrair o valor string
    if (
      entity.email &&
      typeof entity.email === "object" &&
      entity.email.value
    ) {
      this.email = entity.email.value;
    } else if (typeof entity.email === "string") {
      // Se o email for uma string (caso de email inválido), usar diretamente
      this.email = entity.email;
    }
    // Se o phone for um objeto Phone, extrair o valor string
    if (
      entity.phone &&
      typeof entity.phone === "object" &&
      entity.phone.value
    ) {
      this.phone = entity.phone.value;
    }
  }
}

export class AudienceValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "name",
          "email",
          "phone",
          "favorite_genres",
          "favorite_artists",
          "favorite_instruments",
        ];
    return super.validate(notification, new AudienceRules(data), newFields);
  }
}

export class AudienceValidatorFactory {
  static create() {
    return new AudienceValidator();
  }
}
