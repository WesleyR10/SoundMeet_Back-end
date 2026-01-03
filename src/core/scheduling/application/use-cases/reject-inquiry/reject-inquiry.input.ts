import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  validateSync,
} from "class-validator";

export type RejectInquiryInputConstructorProps = {
  inquiry_id: string;
  reason?: string | null;
};

export class RejectInquiryInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  inquiry_id: string;

  @IsString()
  @IsOptional()
  reason?: string | null;

  constructor(props: RejectInquiryInputConstructorProps) {
    if (!props) return;
    this.inquiry_id = props.inquiry_id;
    this.reason = props.reason;
  }
}

export class ValidateRejectInquiryInput {
  static validate(input: RejectInquiryInput) {
    return validateSync(input);
  }
}
