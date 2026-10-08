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

export type ProposeBookingInputConstructorProps = {
  establishment_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
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

export class ProposeBookingInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  establishment_id: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  musician_id?: string | null;

  @IsString()
  @IsOptional()
  @IsUUID()
  band_id?: string | null;

  @IsString()
  @IsOptional()
  @IsUUID()
  event_id?: string | null;

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
   * Lado que originou a proposta, derivado dos papéis do JWT no controller.
   *
   * ⚠️ **Sem decorator de validação de propósito.** `ProposeBookingDto` estende
   * esta classe, e o ValidationPipe global roda com `whitelist: true` — uma
   * propriedade sem decorator é REMOVIDA do corpo antes de chegar ao handler.
   * Ou seja, um cliente que tente mandar `proposed_by: "musician"` para simular
   * aceite do artista tem o campo descartado, e o controller escreve o valor
   * correto logo em seguida. É uma barreira mais forte que a de `is_admin`, que
   * depende só da atribuição pós-spread.
   */
  proposed_by?: string | null;

  constructor(props: ProposeBookingInputConstructorProps) {
    if (!props) return;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.event_id = props.event_id;
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

export class ValidateProposeBookingInput {
  static validate(input: ProposeBookingInput) {
    return validateSync(input);
  }
}
