import { IsNotEmpty, IsUUID, validateSync } from "class-validator";

export type GetRequestFeedbackInputConstructorProps = {
  request_id: string;
};

export class GetRequestFeedbackInput {
  @IsUUID()
  @IsNotEmpty()
  request_id: string;

  constructor(props: GetRequestFeedbackInputConstructorProps) {
    if (!props) return;

    this.request_id = props.request_id;
  }
}

export class ValidateGetRequestFeedbackInput {
  static validate(input: GetRequestFeedbackInput) {
    return validateSync(input);
  }
}
