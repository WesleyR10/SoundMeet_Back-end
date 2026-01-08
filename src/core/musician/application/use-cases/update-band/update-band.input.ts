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
  validateSync,
} from "class-validator";

import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import { PriceRangeProps } from "../../../../shared/domain/value-objects/price-range.vo";

export class UpdateBandPriceRangeInput {
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

export type UpdateBandInputConstructorProps = {
  id: string;
  name?: string;
  description?: string;
  avatar?: string;
  genres?: string[];
  priceRange?: UpdateBandPriceRangeInput | null;
  is_active?: boolean;
};

export class UpdateBandInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsArray()
  @IsOptional()
  genres?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBandPriceRangeInput)
  priceRange?: UpdateBandPriceRangeInput | null;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  constructor(props: UpdateBandInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.avatar = props.avatar;
    this.genres = props.genres;
    this.priceRange = props.priceRange;
    this.is_active = props.is_active;
  }

  validate() {
    return validateSync(this);
  }
}
