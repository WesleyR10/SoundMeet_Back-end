import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  validateSync,
} from "class-validator";

export type GetMonthSlotsInputConstructorProps = {
  target_type: "musician" | "band";
  target_id: string;
  year: number;
  month: number;
  slot_minutes?: number;
};

export class GetMonthSlotsInput {
  @IsString()
  @IsNotEmpty()
  @IsIn(["musician", "band"])
  target_type: "musician" | "band";

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  target_id: string;

  @Type(() => Number)
  @IsInt()
  @Min(1970)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(240)
  @IsOptional()
  slot_minutes?: number;

  constructor(props: GetMonthSlotsInputConstructorProps) {
    if (!props) return;
    this.target_type = props.target_type;
    this.target_id = props.target_id;
    this.year = props.year;
    this.month = props.month;
    this.slot_minutes = props.slot_minutes;
  }
}

export class ValidateGetMonthSlotsInput {
  static validate(input: GetMonthSlotsInput) {
    return validateSync(input);
  }
}
