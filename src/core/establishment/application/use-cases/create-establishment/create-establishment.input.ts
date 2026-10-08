import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  validateSync,
} from "class-validator";

import { IsExternalUrl } from "../../../../shared/application/validators/is-external-url.validator";

export type EstablishmentType =
  | "bar"
  | "restaurant"
  | "club"
  | "pub"
  | "cafe"
  | "hotel"
  | "theater"
  | "other";

export const ESTABLISHMENT_TYPES: EstablishmentType[] = [
  "bar",
  "restaurant",
  "club",
  "pub",
  "cafe",
  "hotel",
  "theater",
  "other",
];

export type CreateEstablishmentInputConstructorProps = {
  name: string;
  description?: string;
  avatar?: string;
  cnpj?: string;
  email: string;
  phone: string;
  website?: string;
  establishment_type: EstablishmentType;
  is_active?: boolean;
  existing_establishment_ids?: string[];
  owner_user_id?: string;
};

export class CreateEstablishmentInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  avatar?: string;

  @IsString()
  @IsOptional()
  @MaxLength(18)
  cnpj?: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @IsExternalUrl()
  website?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(ESTABLISHMENT_TYPES)
  @MaxLength(50)
  establishment_type: EstablishmentType;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  existing_establishment_ids: string[];

  // `sub` do JWT de quem está criando. Recebe o claim `establishment_ids` para
  // conseguir operar o estabelecimento depois — o id do agregado não é o `sub`.
  @IsString()
  @IsOptional()
  owner_user_id?: string;

  constructor(props: CreateEstablishmentInputConstructorProps) {
    if (!props) return;
    this.name = props.name;
    this.description = props.description;
    this.avatar = props.avatar;
    this.cnpj = props.cnpj;
    this.email = props.email;
    this.phone = props.phone;
    this.website = props.website;
    this.establishment_type = props.establishment_type;
    this.is_active = props.is_active ?? true;
    this.existing_establishment_ids = props.existing_establishment_ids ?? [];
    this.owner_user_id = props.owner_user_id;
  }
}

export class ValidateCreateEstablishmentInput {
  static validate(input: CreateEstablishmentInput) {
    return validateSync(input);
  }
}
