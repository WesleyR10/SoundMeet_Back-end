import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from "class-validator";

import { PriceRangeProps } from "../../../../shared/domain/value-objects/price-range.vo";

export type UpdateMusicianInputConstructorProps = {
  id: string;
  email?: string;
  name?: string;
  stage_name?: string;
  bio?: string;
  avatar?: string;
  phone?: string;
  genres?: string[];
  instruments?: string[];
  experience_years?: number;
  priceRange?: PriceRangeProps | null;
  is_active?: boolean;
  is_verified?: boolean;
};

export class UpdateMusicianInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  stage_name?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsArray()
  @IsOptional()
  genres?: string[];

  @IsArray()
  @IsOptional()
  instruments?: string[];

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  experience_years?: number;

  @IsOptional()
  priceRange?: PriceRangeProps | null;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsBoolean()
  @IsOptional()
  is_verified?: boolean;

  constructor(props: UpdateMusicianInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.email = props.email;
    this.name = props.name;
    this.stage_name = props.stage_name;
    this.bio = props.bio;
    this.avatar = props.avatar;
    this.phone = props.phone;
    this.genres = props.genres;
    this.instruments = props.instruments;
    this.experience_years = props.experience_years;
    this.priceRange = props.priceRange;
    this.is_active = props.is_active;
    this.is_verified = props.is_verified;
  }
}

export class ValidateUpdateMusicianInput {
  static validate(input: UpdateMusicianInput) {
    return validateSync(input);
  }
}
