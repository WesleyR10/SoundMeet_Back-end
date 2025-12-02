import { CreateEstablishmentInput } from "../../../core/establishment/application/use-cases/create-establishment/create-establishment.input";
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateEstablishmentDto implements CreateEstablishmentInput {
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
}
