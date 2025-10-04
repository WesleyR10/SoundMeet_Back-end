import { IsNotEmpty, IsUUID, validateSync } from "class-validator";

export type DeleteRequestInputConstructorProps = {
  id: string;
};

export class DeleteRequestInput {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  constructor(props: DeleteRequestInputConstructorProps) {
    if (!props) return;

    this.id = props.id;
  }
}

export class ValidateDeleteRequestInput {
  static validate(input: DeleteRequestInput) {
    return validateSync(input);
  }
}
