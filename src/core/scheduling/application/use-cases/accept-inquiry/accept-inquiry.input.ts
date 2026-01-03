import { IsNotEmpty, IsString, IsUUID, validateSync } from "class-validator";

export type AcceptInquiryInputConstructorProps = {
  inquiry_id: string;
};

export class AcceptInquiryInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  inquiry_id: string;

  constructor(props: AcceptInquiryInputConstructorProps) {
    if (!props) return;
    this.inquiry_id = props.inquiry_id;
  }
}

export class ValidateAcceptInquiryInput {
  static validate(input: AcceptInquiryInput) {
    return validateSync(input);
  }
}
