import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsIn,
  ValidateIf,
  Matches,
} from "class-validator";
import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Establishment } from "./establishment.aggregate";
import { CNPJ } from "../../shared/domain/value-objects/cnpj.vo";

export class EstablishmentRules {
  @MaxLength(255, { groups: ["name"] })
  @IsNotEmpty({ groups: ["name"] })
  @IsString({ groups: ["name"] })
  name: string;

  @IsEmail({}, { groups: ["email"] })
  @IsNotEmpty({ groups: ["email"] })
  email: string;

  @MaxLength(1000, { groups: ["description"] })
  @IsOptional({ groups: ["description"] })
  @IsString({ groups: ["description"] })
  description?: string;

  @MaxLength(500, { groups: ["avatar"] })
  @IsOptional({ groups: ["avatar"] })
  @IsString({ groups: ["avatar"] })
  avatar?: string;

  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$|^\d{14}$/, {
    message: "CNPJ must be in format XX.XXX.XXX/XXXX-XX or 14 digits",
    groups: ["cnpj"],
  })
  @ValidateIf((o) => o.cnpj !== null && o.cnpj !== undefined, {
    groups: ["cnpj"],
  })
  @IsOptional({ groups: ["cnpj"] })
  @IsString({ groups: ["cnpj"] })
  cnpj?: string;

  @MaxLength(20, { groups: ["phone"] })
  @ValidateIf((o) => o.phone !== null && o.phone !== undefined, {
    groups: ["phone"],
  })
  @IsOptional({ groups: ["phone"] })
  @IsString({ groups: ["phone"] })
  phone?: string;

  @MaxLength(500, { groups: ["website"] })
  @IsOptional({ groups: ["website"] })
  @IsString({ groups: ["website"] })
  website?: string;

  @IsNotEmpty({ groups: ["address"] })
  address: any;

  @IsIn(
    ["bar", "restaurant", "club", "pub", "cafe", "hotel", "theater", "other"],
    { groups: ["establishment_type"] },
  )
  @IsNotEmpty({ groups: ["establishment_type"] })
  @IsString({ groups: ["establishment_type"] })
  establishment_type: string;

  @IsBoolean({ groups: ["is_active"] })
  @IsOptional({ groups: ["is_active"] })
  is_active?: boolean;

  @IsBoolean({ groups: ["is_verified"] })
  @IsOptional({ groups: ["is_verified"] })
  is_verified?: boolean;

  constructor(entity: Establishment | any) {
    Object.assign(this, {
      name: entity.name,
      email:
        typeof entity.email === "string" ? entity.email : entity.email?.value,
      description: entity.description,
      avatar: entity.avatar,
      cnpj: entity.cnpj instanceof CNPJ ? entity.cnpj.value : entity.cnpj,
      phone:
        typeof entity.phone === "string" ? entity.phone : entity.phone?.value,
      website: entity.website,
      address: entity.address,
      establishment_type: entity.establishment_type,
      is_active: entity.is_active,
      is_verified: entity.is_verified,
    });
  }
}

export class EstablishmentValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "name",
          "email",
          "phone",
          "address_street",
          "address_city",
          "establishment_type",
        ];
    return super.validate(
      notification,
      new EstablishmentRules(data),
      newFields,
    );
  }
}

export class EstablishmentValidatorFactory {
  static create(): EstablishmentValidator {
    return new EstablishmentValidator();
  }
}
