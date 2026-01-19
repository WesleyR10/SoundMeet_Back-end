import { Type } from "class-transformer";
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

import {
  AddressInput,
  PriceRangeInput,
  SocialLinksInput,
} from "../update-establishment-profile/update-establishment-profile.input";

export class CreateEstablishmentProfileInput {
  @IsUUID()
  id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacity?: number | null;

  @ValidateNested()
  @Type(() => AddressInput)
  location: AddressInput;

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
