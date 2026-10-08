import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  validateSync,
} from "class-validator";

export type GetRequestFeedbackInputConstructorProps = {
  request_id: string;
  requesting_participant_ids?: string[] | null;
  is_admin?: boolean;
};

export class GetRequestFeedbackInput {
  @IsUUID()
  @IsNotEmpty()
  request_id: string;

  // Mesmo esquema de identidade de GetRequestInput — RequestFeedback não tem
  // audience_id/musician_id próprios, então o use-case resolve via Request.
  @IsUUID("4", { each: true })
  @IsOptional()
  requesting_participant_ids?: string[] | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: GetRequestFeedbackInputConstructorProps) {
    if (!props) return;

    this.request_id = props.request_id;
    this.requesting_participant_ids = props.requesting_participant_ids;
    this.is_admin = props.is_admin;
  }
}

export class ValidateGetRequestFeedbackInput {
  static validate(input: GetRequestFeedbackInput) {
    return validateSync(input);
  }
}
