import { IsOptional, IsString, IsUUID } from "class-validator";

/**
 * Registro da apresentação pelo artista.
 *
 * Não carrega data: quem marca a hora é o SERVIDOR. Aceitar `checked_in_at` do
 * corpo permitiria registrar um show de ontem como se fosse de hoje, ou o
 * contrário — e este registro existe justamente para provar *quando* algo
 * aconteceu.
 */
export class CheckInBookingInput {
  @IsUUID("4")
  booking_id: string;

  // ── Preenchidos pelo controller a partir do JWT ───────────────────────────

  @IsOptional()
  requesting_participant_ids?: string[];

  @IsOptional()
  @IsString()
  requesting_musician_id?: string;

  @IsOptional()
  is_admin?: boolean;
}
