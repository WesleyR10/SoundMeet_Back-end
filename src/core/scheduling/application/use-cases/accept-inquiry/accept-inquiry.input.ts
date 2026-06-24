import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  validateSync,
} from "class-validator";

export type AcceptInquiryInputConstructorProps = {
  inquiry_id: string;
  requesting_user_id?: string | null;
  is_admin?: boolean;
};

export class AcceptInquiryInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  inquiry_id: string;

  @IsString()
  @IsUUID()
  @IsOptional()
  requesting_user_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: AcceptInquiryInputConstructorProps) {
    if (!props) return;
    this.inquiry_id = props.inquiry_id;
    this.requesting_user_id = props.requesting_user_id;
    this.is_admin = props.is_admin ?? false;
  }
}

export class ValidateAcceptInquiryInput {
  static validate(input: AcceptInquiryInput) {
    return validateSync(input);
  }
}
