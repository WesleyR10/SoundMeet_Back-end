import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  validateSync,
} from "class-validator";

export enum RespondToRequestAction {
  ACCEPT = "accept",
  REJECT = "reject",
}

export type RespondToRequestInputConstructorProps = {
  request_id: string;
  musician_id: string; // Para validar que apenas o músico destinatário pode responder
  action: RespondToRequestAction;
  rejection_reason?: string;
};

export class RespondToRequestInput {
  @IsUUID()
  @IsNotEmpty()
  request_id: string;

  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsEnum(RespondToRequestAction)
  @IsNotEmpty()
  action: RespondToRequestAction;

  @IsString()
  @IsOptional()
  @MinLength(1, { message: "Rejection reason must have at least 1 character" })
  @MaxLength(500, { message: "Rejection reason cannot exceed 500 characters" })
  rejection_reason?: string;

  constructor(props: RespondToRequestInputConstructorProps) {
    if (!props) return;

    this.request_id = props.request_id;
    this.musician_id = props.musician_id;
    this.action = props.action;
    this.rejection_reason = props.rejection_reason;
  }
}

export class ValidateRespondToRequestInput {
  static validate(input: RespondToRequestInput) {
    return validateSync(input);
  }
}
