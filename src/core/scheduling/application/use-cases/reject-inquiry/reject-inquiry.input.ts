import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  validateSync,
} from "class-validator";

export type RejectInquiryInputConstructorProps = {
  inquiry_id: string;
  reason?: string | null;
  requesting_user_id?: string | null;
  is_admin?: boolean;
};

export class RejectInquiryInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  inquiry_id: string;

  @IsString()
  @IsOptional()
  reason?: string | null;

  @IsString()
  @IsUUID()
  @IsOptional()
  requesting_user_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: RejectInquiryInputConstructorProps) {
    if (!props) return;
    this.inquiry_id = props.inquiry_id;
    this.reason = props.reason;
    this.requesting_user_id = props.requesting_user_id;
    this.is_admin = props.is_admin ?? false;
  }
}

export class ValidateRejectInquiryInput {
  static validate(input: RejectInquiryInput) {
    return validateSync(input);
  }
}
