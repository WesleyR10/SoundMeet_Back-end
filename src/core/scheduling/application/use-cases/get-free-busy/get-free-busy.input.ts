import { Type } from "class-transformer";
import {
  IsDate,
  IsIn,
  IsNotEmpty,
  IsString,
  IsUUID,
  validateSync,
} from "class-validator";

export type GetFreeBusyInputConstructorProps = {
  target_type: "musician" | "band";
  target_id: string;
  start_at: Date;
  end_at: Date;
};

export class GetFreeBusyInput {
  @IsString()
  @IsNotEmpty()
  @IsIn(["musician", "band"])
  target_type: "musician" | "band";

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  target_id: string;

  @Type(() => Date)
  @IsDate()
  start_at: Date;

  @Type(() => Date)
  @IsDate()
  end_at: Date;

  constructor(props: GetFreeBusyInputConstructorProps) {
    if (!props) return;
    this.target_type = props.target_type;
    this.target_id = props.target_id;
    this.start_at = props.start_at;
    this.end_at = props.end_at;
  }
}

export class ValidateGetFreeBusyInput {
  static validate(input: GetFreeBusyInput) {
    return validateSync(input);
  }
}
