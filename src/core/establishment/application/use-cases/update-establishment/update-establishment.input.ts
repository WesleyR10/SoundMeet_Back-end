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

export type UpdateEstablishmentInputConstructorProps = {
  id: string;
  name?: string;
  description?: string;
  avatar?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  website?: string;
  establishment_type?: "bar" | "restaurant" | "club";
  is_active?: boolean;
  is_verified?: boolean;
};

export class UpdateEstablishmentInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

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
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  website?: string;

  @IsString()
  @IsOptional()
  @IsIn(["bar", "restaurant", "club"])
  @MaxLength(50)
  establishment_type?: "bar" | "restaurant" | "club";

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsBoolean()
  @IsOptional()
  is_verified?: boolean;

  constructor(props: UpdateEstablishmentInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.avatar = props.avatar;
    this.cnpj = props.cnpj;
    this.email = props.email;
    this.phone = props.phone;
    this.website = props.website;
    this.establishment_type = props.establishment_type;
    this.is_active = props.is_active;
    this.is_verified = props.is_verified;
  }
}

export class ValidateUpdateEstablishmentInput {
  static validate(input: UpdateEstablishmentInput) {
    return validateSync(input);
  }
}
