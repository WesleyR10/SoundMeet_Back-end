import { IsNotEmpty, IsOptional, IsUUID, validateSync } from "class-validator";

export type DeleteRequestInputConstructorProps = {
  id: string;
  requesting_audience_id?: string;
};

export class DeleteRequestInput {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsUUID()
  @IsOptional()
  requesting_audience_id?: string;

  constructor(props: DeleteRequestInputConstructorProps) {
    if (!props) return;

    this.id = props.id;
    props.requesting_audience_id !== undefined &&
      (this.requesting_audience_id = props.requesting_audience_id);
  }
}

export class ValidateDeleteRequestInput {
  static validate(input: DeleteRequestInput) {
    return validateSync(input);
  }
}
