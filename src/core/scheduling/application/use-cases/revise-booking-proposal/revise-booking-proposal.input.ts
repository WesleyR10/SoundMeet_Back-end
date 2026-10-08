import { Type } from "class-transformer";
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

/**
 * Corpo de `POST /scheduling/bookings/:id/revise` — só os TERMOS.
 *
 * ⚠️ Nada de alvo, estabelecimento ou autoria aqui: quem são as partes está no
 * booking, e quem revisou vem do JWT. Aceitar `musician_id` no corpo de uma
 * revisão permitiria "revisar" uma proposta trocando o artista dela.
 */
export class ReviseBookingProposalBody {
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

  // Mesmo teto de `BOOKING_LIMITS.NOTES_MAX` no painel web.
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string | null;
}

export type ReviseBookingProposalInput = {
  booking_id: string;
  start_at: Date;
  end_at: Date;
  fee: number;
  notes?: string | null;
  /** Lado que revisou — derivado do JWT no controller, nunca do corpo. */
  proposed_by: "establishment" | "musician" | "band";
  requesting_participant_ids?: string[] | null;
  requesting_musician_id?: string | null;
  is_admin?: boolean;
};
