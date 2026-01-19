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

export type CreateEstablishmentInputConstructorProps = {
  name: string;
  description?: string;
  avatar?: string;
  cnpj?: string;
  email: string;
  phone: string;
  website?: string;
  establishment_type: "bar" | "restaurant" | "club";
  is_active?: boolean;
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
  website?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(["bar", "restaurant", "club"])
  @MaxLength(50)
  establishment_type: "bar" | "restaurant" | "club";

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

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
  }
}

export class ValidateCreateEstablishmentInput {
  static validate(input: CreateEstablishmentInput) {
    return validateSync(input);
  }
}
