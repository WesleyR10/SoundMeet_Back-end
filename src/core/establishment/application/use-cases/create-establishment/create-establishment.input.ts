import {
  IsBoolean,
  IsEmail,
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
  address_street: string;
  address_number: string;
  address_neighborhood?: string;
  address_city: string;
  address_state: string;
  address_zipcode: string;
  establishment_type: string;
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
  @MaxLength(255)
  address_street: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  address_number: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  address_neighborhood?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  address_city: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  address_state: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  address_zipcode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  establishment_type: string;

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
    this.address_street = props.address_street;
    this.address_number = props.address_number;
    this.address_neighborhood = props.address_neighborhood;
    this.address_city = props.address_city;
    this.address_state = props.address_state;
    this.address_zipcode = props.address_zipcode;
    this.establishment_type = props.establishment_type;
    this.is_active = props.is_active ?? true;
  }
}

export class ValidateCreateEstablishmentInput {
  static validate(input: CreateEstablishmentInput) {
    return validateSync(input);
  }
}
