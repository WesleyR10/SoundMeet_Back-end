import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
  validateSync,
} from "class-validator";

import { LocationProps } from "../../../../shared/domain/value-objects/location.vo";
import { Currency } from "../../../../shared/domain/value-objects/money.vo";

export type CreateMusicianInputConstructorProps = {
  email: string;
  name: string;
  stage_name?: string;
  bio?: string;
  avatar?: string;
  phone?: string;
  genres?: string[];
  instruments?: string[];
  experience_years?: number;
  priceRanges?: CreateMusicianPriceRangeInput[];
  location?: LocationProps;
  is_active?: boolean;
  open_to_gigs?: boolean | null;
};

export class CreateMusicianPriceRangeInput {
  @IsIn(["per_event", "per_hour"])
  model: "per_event" | "per_hour";

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  min: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  max: number;

  @IsIn(Object.values(Currency))
  @IsOptional()
  currency?: Currency;

  @IsString()
  @IsOptional()
  notes?: string | null;

  constructor(props: CreateMusicianPriceRangeInput) {
    if (!props) return;
    this.model = props.model;
    this.min = props.min;
    this.max = props.max;
    this.currency = props.currency;
    this.notes = props.notes;
  }
}

export class CreateMusicianInput {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

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
  @IsString({ each: true })
  @IsOptional()
  genres?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  instruments?: string[];

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  experience_years?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMusicianPriceRangeInput)
  @IsOptional()
  priceRanges?: CreateMusicianPriceRangeInput[];

  @IsOptional()
  location?: LocationProps;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  // Nunca default true — consentimento explícito, decidido no onboarding
  // (aqui ou depois via PATCH /musicians/:id/open-to-gigs).
  @IsBoolean()
  @IsOptional()
  open_to_gigs?: boolean | null;

  constructor(props: CreateMusicianInputConstructorProps) {
    if (!props) return;
    this.email = props.email;
    this.name = props.name;
    this.stage_name = props.stage_name;
    this.bio = props.bio;
    this.avatar = props.avatar;
    this.phone = props.phone;
    this.genres = props.genres;
    this.instruments = props.instruments;
    this.experience_years = props.experience_years;
    this.priceRanges = props.priceRanges;
    this.location = props.location;
    this.is_active = props.is_active ?? true;
    this.open_to_gigs = props.open_to_gigs;
  }
}

export class ValidateCreateMusicianInput {
  static validate(input: CreateMusicianInput) {
    return validateSync(input);
  }
}
