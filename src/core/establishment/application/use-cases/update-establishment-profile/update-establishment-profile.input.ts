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
  @Type(() => PriceRangeInput)
  priceRange?: PriceRangeInput | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksInput)
  socialLinks?: SocialLinksInput | null;
}
