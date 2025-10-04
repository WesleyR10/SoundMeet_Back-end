import { IsNotEmpty, IsUUID, validateSync } from "class-validator";

export type GetRequestInputConstructorProps = {
  id: string;
};

export class GetRequestInput {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  constructor(props: GetRequestInputConstructorProps) {
    if (!props) return;

    this.id = props.id;
  }
}

export class ValidateGetRequestInput {
  static validate(input: GetRequestInput) {
    return validateSync(input);
  }
}
