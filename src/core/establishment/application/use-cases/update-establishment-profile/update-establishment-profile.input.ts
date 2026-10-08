import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
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

export class StageTechSpecDimensionsInput {
  @IsOptional()
  @IsNumber()
  widthM?: number | null;

  @IsOptional()
  @IsNumber()
  depthM?: number | null;

  @IsOptional()
  @IsNumber()
  heightM?: number | null;
}

export class StageTechSpecPowerInput {
  @IsOptional()
  @IsInt()
  @Min(0)
  outlets?: number | null;

  @IsOptional()
  @IsString()
  voltage?: string | null;
}

/**
 * Ficha técnica do palco (A3). Todo campo é opcional por desenho — meia ficha
 * vale mais que ficha nenhuma. As regras finas (limites, formato da janela de
 * passagem de som, dedupe do backline) ficam no `StageTechSpec` VO; aqui só o
 * contrato de forma, para o 422 sair na fronteira em vez de virar erro de
 * notificação lá dentro.
 */
export class StageTechSpecInput {
  @IsOptional()
  @IsBoolean()
  hasPa?: boolean | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  mixerChannels?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  monitors?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  hasMicrophones?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  backline?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => StageTechSpecDimensionsInput)
  dimensions?: StageTechSpecDimensionsInput | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => StageTechSpecPowerInput)
  power?: StageTechSpecPowerInput | null;

  @IsOptional()
  @IsBoolean()
  hasParking?: boolean | null;

  @IsOptional()
  @IsBoolean()
  hasSoundEngineer?: boolean | null;

  @IsOptional()
  @IsString()
  soundcheckWindow?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class AddressInput {
  @IsString()
  street: string;

  @IsString()
  number: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsString()
  neighborhood: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  zipCode: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class SocialLinkInput {
  @IsIn([
    "instagram",
    "facebook",
    "twitter",
    "tiktok",
    "youtube",
    "spotify",
    "linkedin",
  ])
  platform:
    | "instagram"
    | "facebook"
    | "twitter"
    | "tiktok"
    | "youtube"
    | "spotify"
    | "linkedin";

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  followersCount?: number;
}

export class SocialLinksInput {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkInput)
  links: SocialLinkInput[];
}

export class UpdateEstablishmentProfileInput {
  @IsUUID()
  id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacity?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInput)
  location?: AddressInput;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredGenres?: string[];

  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, unknown> | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => StageTechSpecInput)
  stageTechSpec?: StageTechSpecInput | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PriceRangeInput)
  priceRange?: PriceRangeInput | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksInput)
  socialLinks?: SocialLinksInput | null;
}
