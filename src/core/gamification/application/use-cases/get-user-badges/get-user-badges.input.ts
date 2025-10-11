import { IsNotEmpty, IsString, validateSync } from "class-validator";

export type GetUserBadgesInputConstructorProps = {
  user_id: string;
};

export class GetUserBadgesInput {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  constructor(props: GetUserBadgesInputConstructorProps) {
    if (!props) return;
    this.user_id = props.user_id;
  }
}

export class ValidateGetUserBadgesInput {
  static validate(input: GetUserBadgesInput) {
    return validateSync(input);
  }
}
