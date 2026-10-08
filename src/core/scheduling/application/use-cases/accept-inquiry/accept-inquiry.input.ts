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
  requesting_participant_ids?: string[] | null;
  requesting_musician_id?: string | null;
  is_admin?: boolean;
};

export class AcceptInquiryInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  inquiry_id: string;

  // Identidade do ator: `sub` + claims `establishment_ids`/`band_ids`. Um id só
  // não serve — estabelecimento e banda têm UUID próprio, distinto do `sub`.
  @IsUUID("4", { each: true })
  @IsOptional()
  requesting_participant_ids?: string[] | null;

  // `sub` do JWT, separado dos claims: representar a banda não é decidir por
  // ela — a liderança é checada contra este id (ver negotiation-actor.ts).
  @IsUUID()
  @IsOptional()
  requesting_musician_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: AcceptInquiryInputConstructorProps) {
    if (!props) return;
    this.inquiry_id = props.inquiry_id;
    this.requesting_participant_ids = props.requesting_participant_ids;
    this.requesting_musician_id = props.requesting_musician_id;
    this.is_admin = props.is_admin ?? false;
  }
}

export class ValidateAcceptInquiryInput {
  static validate(input: AcceptInquiryInput) {
    return validateSync(input);
  }
}
