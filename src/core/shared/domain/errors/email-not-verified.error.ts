import { DomainError } from "./domain.error";

/**
 * Ação exige e-mail confirmado e o usuário ainda não confirmou.
 *
 * 🔴 **Status próprio (403) e `code` próprio, de propósito.** O cliente precisa
 * distinguir isto de qualquer outra recusa para poder oferecer "reenviar
 * e-mail" — a única saída real do usuário. Caído no 422 genérico de validação,
 * viraria "não foi possível sacar", que manda a pessoa para o suporte em vez de
 * para a caixa de entrada. Mesma razão pela qual o limite de plano tem 402 só
 * dele (`PlanLimitExceededError`).
 */
export class EmailNotVerifiedError extends DomainError {
  static readonly CODE = "EMAIL_NOT_VERIFIED";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}
