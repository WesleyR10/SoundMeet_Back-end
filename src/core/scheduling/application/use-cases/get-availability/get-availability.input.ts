import { IsNotEmpty, IsString, IsUUID, validateSync } from "class-validator";

export type GetAvailabilityInputConstructorProps = {
  musician_id: string;
};

export class GetAvailabilityInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  musician_id: string;

  constructor(props: GetAvailabilityInputConstructorProps) {
    if (!props) return;
    this.musician_id = props.musician_id;
  }
}

export class ValidateGetAvailabilityInput {
  static validate(input: GetAvailabilityInput) {
    return validateSync(input);
  }
}
