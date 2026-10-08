import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

/**
 * Contestação da apresentação pelo estabelecimento.
 *
 * Não carrega data — quem marca a hora é o servidor, pelo mesmo motivo do
 * check-in: a janela de contestação é contada a partir dela.
 */
export class DisputeBookingInput {
  @IsUUID("4")
  booking_id: string;

  /**
   * Obrigatório. Contestação sem motivo registrado trava dinheiro sem ninguém
   * conseguir dizer por quê — e quem lê isso depois é a mediação.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  // ── Preenchidos pelo controller a partir do JWT ───────────────────────────

  @IsOptional()
  requesting_participant_ids?: string[];

  @IsOptional()
  is_admin?: boolean;
}
