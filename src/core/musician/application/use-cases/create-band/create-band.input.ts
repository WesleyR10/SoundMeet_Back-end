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
  is_active?: boolean;
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

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  constructor(props: CreateBandInputConstructorProps) {
    if (!props) return;
    this.name = props.name;
    this.description = props.description;
    this.avatar = props.avatar;
    this.genres = props.genres;
    this.members = props.members;
    this.priceRange = props.priceRange;
    this.is_active = props.is_active;
  }
}
