import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  validateSync,
} from "class-validator";

export type ConvertInquiryToBookingInputConstructorProps = {
  inquiry_id: string;
  start_at: Date;
  end_at: Date;
  fee: number;
  notes?: string | null;
  buffer_minutes?: number;
  expires_at?: Date | null;
  requesting_participant_ids?: string[] | null;
  requesting_musician_id?: string | null;
  is_admin?: boolean;
  proposed_by?: string | null;
};

export class ConvertInquiryToBookingInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  inquiry_id: string;

  @Type(() => Date)
  @IsDate()
  start_at: Date;

  @Type(() => Date)
  @IsDate()
  end_at: Date;

  /**
   * Cachê em reais — OBRIGATÓRIO desde 25/set/2026: proposta é oferta, e oferta
   * sem valor não tem o que aceitar. Quem só quer conversar abre uma inquiry.
   * A barreira final é `Booking.assertProposalTerms`; aqui é para o 422 nomear
   * o campo antes de chegar ao domínio.
   */
  @IsNumber()
  @IsPositive()
  fee: number;

  @IsString()
  @IsOptional()
  notes?: string | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  buffer_minutes?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  expires_at?: Date | null;

  // Identidade do ator — vem do JWT no controller, nunca do corpo.
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

  /**
   * Lado que converteu, derivado do JWT no controller.
   *
   * ⚠️ Sem decorator de propósito — mesma barreira de `ProposeBookingInput`:
   * com `whitelist`, um `proposed_by` vindo do corpo nunca chega aqui.
   */
  proposed_by?: string | null;

  constructor(props: ConvertInquiryToBookingInputConstructorProps) {
    if (!props) return;
    this.inquiry_id = props.inquiry_id;
    this.start_at = props.start_at;
    this.end_at = props.end_at;
    this.fee = props.fee;
    this.notes = props.notes;
    this.buffer_minutes = props.buffer_minutes;
    this.expires_at = props.expires_at;
    this.requesting_participant_ids = props.requesting_participant_ids;
    this.requesting_musician_id = props.requesting_musician_id;
    this.is_admin = props.is_admin ?? false;
    this.proposed_by = props.proposed_by ?? null;
  }
}

export class ValidateConvertInquiryToBookingInput {
  static validate(input: ConvertInquiryToBookingInput) {
    return validateSync(input);
  }
}
