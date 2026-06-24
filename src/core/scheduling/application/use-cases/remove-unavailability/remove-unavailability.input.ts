import { IsNotEmpty, IsString, IsUUID, validateSync } from "class-validator";

export type RemoveUnavailabilityInputConstructorProps = {
  musician_id: string;
  block_id: string;
};

export class RemoveUnavailabilityInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  block_id: string;

  constructor(props: RemoveUnavailabilityInputConstructorProps) {
    if (!props) return;
    this.musician_id = props.musician_id;
    this.block_id = props.block_id;
  }
}

export class ValidateRemoveUnavailabilityInput {
  static validate(input: RemoveUnavailabilityInput) {
    return validateSync(input);
  }
}
