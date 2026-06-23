import {
  IsArray,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { PriceRange } from "../../shared/domain/value-objects/price-range.vo";
import { MusicianProfile } from "./musician-profile.aggregate";

export class MusicianProfileRules {
  @IsUUID(undefined, { groups: ["musician_id"] })
  @IsNotEmpty({ groups: ["musician_id"] })
  musician_id: string;

  @IsNumber({}, { groups: ["experience"] })
  @Min(0, { groups: ["experience"] })
  experience: number;

  @IsArray({ groups: ["instruments"] })
  @IsString({ each: true, groups: ["instruments"] })
  instruments: string[];

  @IsArray({ groups: ["genres"] })
  @IsString({ each: true, groups: ["genres"] })
  genres: string[];

  @IsOptional({ groups: ["socialLinks"] })
  @IsObject({ groups: ["socialLinks"] })
  socialLinks: object | null;

  @IsOptional({ groups: ["priceRange"] })
  priceRange?: PriceRange | null;

  @IsObject({ groups: ["location"] })
  location: object;

  @IsDate({ groups: ["created_at"] })
  @IsOptional({ groups: ["created_at"] })
  created_at: Date;

  @IsDate({ groups: ["updated_at"] })
  @IsOptional({ groups: ["updated_at"] })
  updated_at: Date;

  constructor(entity: MusicianProfile | any) {
    this.musician_id = entity?.musician_id?.id ?? entity?.musician_id;
    this.experience = entity?.experience;
    this.instruments = entity?.instruments;
    this.genres = entity?.genres;
    this.socialLinks = entity?.socialLinks;
    this.priceRange = entity?.priceRange;
    this.location = entity?.location?.toJSON
      ? entity.location.toJSON()
      : entity?.location;
    this.created_at = entity?.created_at;
    this.updated_at = entity?.updated_at;
  }
}

export class MusicianProfileValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "musician_id",
          "experience",
          "instruments",
          "genres",
          "socialLinks",
          "priceRange",
          "location",
          "created_at",
          "updated_at",
        ];
    return super.validate(
      notification,
      new MusicianProfileRules(data),
      newFields,
    );
  }
}

export class MusicianProfileValidatorFactory {
  static create(): MusicianProfileValidator {
    return new MusicianProfileValidator();
  }
}
