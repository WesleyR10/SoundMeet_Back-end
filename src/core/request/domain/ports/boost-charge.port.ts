/**
 * Cria a cobrança do destaque no provedor de pagamento.
 *
 * O domínio de `request` não conhece `payment`: o adapter que chama
 * `SendTipUseCase` mora no módulo Nest e é injetado aqui (mesma inversão de
 * `ITipEligibilityPort`).
 */
export type BoostChargeCommand = {
  audience_id: string;
  musician_id: string;
  event_id: string;
  amount: number;
  /** Vira a `message` da gorjeta — é o que o músico lê junto do valor. */
  dedication: string | null;
};

export type BoostChargeResult = {
  tip_id: string;
  qr_code: string | null;
  copy_paste_code: string | null;
};

export interface IBoostChargePort {
  createCharge(command: BoostChargeCommand): Promise<BoostChargeResult>;
  /**
   * Relê o payload de uma cobrança já criada.
   *
   * É o que permite ao fã reabrir o QR depois de fechar o app — a cobrança
   * nasce no aceite do músico, quando ele nem estava na tela.
   */
  getCharge(tip_id: string): Promise<BoostChargeResult | null>;
}
