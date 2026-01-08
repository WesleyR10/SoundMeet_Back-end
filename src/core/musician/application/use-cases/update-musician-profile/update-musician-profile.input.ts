import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

import { Currency } from "../../../../shared/domain/value-objects/money.vo";

export class PriceRangeInput {
  @IsIn(["per_event", "per_hour"])
  model: "per_event" | "per_hour";

  @IsNumber()
  @Min(0)
  min: number;

  @IsNumber()
  @Min(0)
  max: number;

  @IsOptional()
  @IsIn(Object.values(Currency))
  currency?: Currency;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class LocationInput {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class UpdateMusicianProfileInput {
  @IsUUID()
  id: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PriceRangeInput)
  priceRange?: PriceRangeInput | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationInput)
  location?: LocationInput;

  @IsOptional()
  @IsNumber()
  experience?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instruments?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, unknown> | null;
}
