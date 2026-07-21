import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";

import { PriceRangeInput } from "../common/price-range.input";

export { PriceRangeInput };

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

  // Endereço detalhado opcional (autofill via CEP/ViaCEP no app) — perfis
  // antigos com só city/state continuam válidos.
  @IsOptional()
  @IsString()
  street?: string | null;

  @IsOptional()
  @IsString()
  number?: string | null;

  @IsOptional()
  @IsString()
  complement?: string | null;

  @IsOptional()
  @IsString()
  neighborhood?: string | null;

  // Aceita "01310-100" ou "01310100"; o VO normaliza para 8 dígitos.
  @IsOptional()
  @Matches(/^\d{5}-?\d{3}$/, { message: "zip_code must be a valid CEP" })
  zip_code?: string | null;
}

export class UpdateMusicianProfileInput {
  @IsUUID()
  id: string;

  // Até uma faixa por modelo (per_hour e per_event) — substitui o conjunto
  // inteiro a cada update; null limpa tudo.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => PriceRangeInput)
  priceRanges?: PriceRangeInput[] | null;

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
