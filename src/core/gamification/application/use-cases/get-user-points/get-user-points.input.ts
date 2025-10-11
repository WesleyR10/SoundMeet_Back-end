import { IsNotEmpty, IsString, validateSync } from "class-validator";

export type GetUserPointsInputConstructorProps = {
  user_id: string;
};

export class GetUserPointsInput {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  constructor(props: GetUserPointsInputConstructorProps) {
    if (!props) return;
    this.user_id = props.user_id;
  }
}

export class ValidateGetUserPointsInput {
  static validate(input: GetUserPointsInput) {
    return validateSync(input);
  }
}
