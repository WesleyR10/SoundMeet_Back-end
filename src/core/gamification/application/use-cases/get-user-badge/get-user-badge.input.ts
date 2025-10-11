import { IsNotEmpty, IsString, validateSync } from "class-validator";

export type GetUserBadgeInputConstructorProps = {
  id: string;
};

export class GetUserBadgeInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  constructor(props: GetUserBadgeInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
  }
}

export class ValidateGetUserBadgeInput {
  static validate(input: GetUserBadgeInput) {
    return validateSync(input);
  }
}
