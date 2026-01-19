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
import { EstablishmentProfile } from "./establishment-profile.aggregate";

export class EstablishmentProfileRules {
  @IsUUID(undefined, { groups: ["establishment_id"] })
  @IsNotEmpty({ groups: ["establishment_id"] })
  establishment_id: string;

  @IsOptional({ groups: ["capacity"] })
  @IsNumber({}, { groups: ["capacity"] })
  @Min(0, { groups: ["capacity"] })
  capacity: number | null;

  @IsObject({ groups: ["location"] })
  location: object;

  @IsArray({ groups: ["amenities"] })
  @IsString({ each: true, groups: ["amenities"] })
  amenities: string[];

  @IsArray({ groups: ["preferredGenres"] })
  @IsString({ each: true, groups: ["preferredGenres"] })
  @IsOptional({ groups: ["preferredGenres"] })
  preferredGenres: string[];

  @IsOptional({ groups: ["operatingHours"] })
  @IsObject({ groups: ["operatingHours"] })
  operatingHours: object | null;

  @IsOptional({ groups: ["priceRange"] })
  priceRange?: PriceRange | null;

  @IsOptional({ groups: ["socialLinks"] })
  @IsObject({ groups: ["socialLinks"] })
  socialLinks: object | null;

  @IsDate({ groups: ["created_at"] })
  @IsOptional({ groups: ["created_at"] })
  created_at: Date;

  @IsDate({ groups: ["updated_at"] })
  @IsOptional({ groups: ["updated_at"] })
  updated_at: Date;

  constructor(entity: EstablishmentProfile | any) {
    this.establishment_id =
      entity?.establishment_id?.id ?? entity?.establishment_id;
    this.capacity = entity?.capacity ?? null;
    this.location = entity?.location?.toJSON
      ? entity.location.toJSON()
      : entity?.location;
    this.amenities = entity?.amenities ?? [];
    this.preferredGenres = entity?.preferredGenres ?? [];
    this.operatingHours = entity?.operatingHours?.toJSON
      ? entity.operatingHours.toJSON()
      : (entity?.operatingHours ?? null);
    this.priceRange = entity?.priceRange ?? null;
    this.socialLinks = entity?.socialLinks ?? null;
    this.created_at = entity?.created_at;
    this.updated_at = entity?.updated_at;
  }
}

export class EstablishmentProfileValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "establishment_id",
          "capacity",
          "location",
          "amenities",
          "preferredGenres",
          "operatingHours",
          "priceRange",
          "socialLinks",
          "created_at",
          "updated_at",
        ];
    return super.validate(
      notification,
      new EstablishmentProfileRules(data),
      newFields,
    );
  }
}

export class EstablishmentProfileValidatorFactory {
  static create(): EstablishmentProfileValidator {
    return new EstablishmentProfileValidator();
  }
}
