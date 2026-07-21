import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import { BandMemberProps } from "../../../domain/band.aggregate";
import { LocationInput } from "../update-musician-profile/update-musician-profile.input";

export class CreateBandPriceRangeInput {
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
}

export type CreateBandInputConstructorProps = {
  name: string;
  description?: string | null;
  avatar?: string | null;
  genres: string[];
  members?: BandMemberProps[];
  priceRange?: CreateBandPriceRangeInput | null;
  address?: LocationInput | null;
  open_to_gigs?: boolean | null;
  is_active?: boolean;
  creator_musician_id?: string;
};

export class CreateBandInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsString()
  @IsOptional()
  avatar?: string | null;

  @IsArray()
  @IsString({ each: true })
  genres: string[];

  @IsArray()
  @IsOptional()
  members?: BandMemberProps[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBandPriceRangeInput)
  priceRange?: CreateBandPriceRangeInput | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationInput)
  address?: LocationInput | null;

  // Nunca default true — consentimento explícito do líder, decidido depois
  // via PATCH /bands/:id/open-to-gigs se omitido aqui.
  @IsBoolean()
  @IsOptional()
  open_to_gigs?: boolean | null;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsString()
  @IsOptional()
  creator_musician_id?: string;

  constructor(props: CreateBandInputConstructorProps) {
    if (!props) return;
    this.name = props.name;
    this.description = props.description;
    this.avatar = props.avatar;
    this.genres = props.genres;
    this.members = props.members;
    this.priceRange = props.priceRange;
    this.address = props.address;
    this.open_to_gigs = props.open_to_gigs;
    this.is_active = props.is_active;
    this.creator_musician_id = props.creator_musician_id;
  }
}
