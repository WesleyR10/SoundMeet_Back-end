import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

/**
 * Entrada da assinatura.
 *
 * 🔴 **O corpo carrega uma única coisa: o consentimento.** Nome, documento e
 * papel NÃO vêm daqui:
 *
 * - nome e documento vêm do snapshot congelado da parte, dentro do agregado —
 *   aceitá-los do cliente permitiria assinar com nome alheio;
 * - o papel (`contractor`/`contracted`) é derivado do JWT no controller, mesmo
 *   padrão de `deriveActorSide` em `bookings.controller.ts`.
 *
 * `accept_terms` precisa ser um `true` explícito, vindo de um checkbox
 * dedicado. É o que sustenta o "admitido como válido pelas partes" do art. 10,
 * §2º da MP 2.200-2/2001: consentimento inequívoco não se infere de navegação.
 */
export class SignContractInput {
  @IsUUID("4")
  contract_id: string;

  @IsBoolean()
  accept_terms: boolean;

  /**
   * Código de uso único enviado ao e-mail da parte
   * (`POST /contracts/:id/sign/challenge`).
   *
   * Segundo fator: a conta autenticada prova que alguém com a senha entrou,
   * não quem. Ver `contract-signature-challenge.port.ts`.
   */
  @IsString()
  @IsNotEmpty()
  challenge_code: string;

  // ── Preenchidos pelo controller a partir do JWT e da requisição ───────────

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

  @IsOptional()
  @IsString()
  observed_ip?: string | null;

  @IsOptional()
  @IsString()
  forwarded_for?: string | null;

  @IsOptional()
  @IsString()
  user_agent?: string | null;
}
