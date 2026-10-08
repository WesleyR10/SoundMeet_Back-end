import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

/**
 * Pedido do código de assinatura.
 *
 * Não carrega destinatário: o e-mail vem do **snapshot congelado da parte**
 * dentro do contrato. Aceitar o destino do cliente permitiria pedir o código
 * de um contrato alheio para a própria caixa.
 */
export class RequestSignatureChallengeInput {
  @IsUUID("4")
  contract_id: string;

  // ── Preenchidos pelo controller a partir do JWT ───────────────────────────

  /**
   * O `sub` do JWT — **a âncora de identidade da assinatura**.
   *
   * 🔴 Obrigatório. Era opcional, e os dois use-cases o degradavam para `""`
   * com `?? ""`: a trilha de auditoria passaria a apontar para ninguém no
   * exato documento que existe para provar quem assinou, e a chave do desafio
   * (que inclui o signatário) viraria um balde compartilhado entre pessoas
   * diferentes do mesmo papel. `AuthenticatedUser.userId` é `string` — não há
   * caminho legítimo em que isto falte.
   */
  @IsString()
  @IsNotEmpty()
  requesting_user_id: string;

  @IsOptional()
  requesting_participant_ids?: string[];

  @IsOptional()
  @IsString()
  requesting_musician_id?: string;

  @IsOptional()
  @IsBoolean()
  is_admin?: boolean;
}
