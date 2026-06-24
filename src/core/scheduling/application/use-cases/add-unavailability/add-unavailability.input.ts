import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  validateSync,
} from "class-validator";
import { Type } from "class-transformer";

export type AddUnavailabilityInputConstructorProps = {
  musician_id: string;
  start_at: Date;
  end_at: Date;
  reason?: string | null;
};

export class AddUnavailabilityInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  musician_id: string;

  @IsDate()
  @Type(() => Date)
  start_at: Date;

  @IsDate()
  @Type(() => Date)
  end_at: Date;

  @IsString()
  @IsOptional()
  reason?: string | null;

  constructor(props: AddUnavailabilityInputConstructorProps) {
    if (!props) return;
    this.musician_id = props.musician_id;
    this.start_at = props.start_at;
    this.end_at = props.end_at;
    this.reason = props.reason;
  }
}

export class ValidateAddUnavailabilityInput {
  static validate(input: AddUnavailabilityInput) {
    return validateSync(input);
  }
}
