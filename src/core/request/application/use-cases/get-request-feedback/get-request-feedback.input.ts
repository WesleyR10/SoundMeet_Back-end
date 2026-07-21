import { IsBoolean, IsNotEmpty, IsOptional, IsUUID, validateSync } from "class-validator";

export type GetRequestFeedbackInputConstructorProps = {
  request_id: string;
  requesting_user_id?: string;
  is_admin?: boolean;
};

export class GetRequestFeedbackInput {
  @IsUUID()
  @IsNotEmpty()
  request_id: string;

  // Mesmo esquema de ownership de GetRequestInput — RequestFeedback não tem
  // audience_id/musician_id próprios, então o use-case resolve via Request.
  @IsUUID()
  @IsOptional()
  requesting_user_id?: string;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: GetRequestFeedbackInputConstructorProps) {
    if (!props) return;

    this.request_id = props.request_id;
    this.requesting_user_id = props.requesting_user_id;
    this.is_admin = props.is_admin;
  }
}

export class ValidateGetRequestFeedbackInput {
  static validate(input: GetRequestFeedbackInput) {
    return validateSync(input);
  }
}
