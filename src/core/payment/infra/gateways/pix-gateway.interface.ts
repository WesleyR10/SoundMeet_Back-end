export type PixPaymentRequest = {
  amount: number;
  description?: string;
  payer?: { id?: string; name?: string; email?: string };
  metadata?: Record<string, any>;
  /**
   * Quem RECEBE a gorjeta.
   *
   * 🔴 Não é decoração de payload: no Mercado Pago a cobrança é criada **na
   * conta do músico**, com a comissão saindo por `marketplace_fee` (Orders
   * API). Sem o beneficiário o dinheiro cairia na conta da plataforma, que é
   * exatamente a custódia de recurso de terceiro que a arquitetura recusa
   * (`decisoes-de-gateway.md`, premissa fundamental).
   *
   * Ausente = o adapter decide o comportamento (o mock ignora; o adapter real
   * recusa, porque não tem para quem mandar).
   */
  beneficiary_musician_id?: string | null;
  /** Comissão da plataforma, em reais, já calculada em centavos inteiros. */
  platform_fee?: number;
};

export type PixPaymentResponse = {
  qr_code: string;
  copy_paste_code: string;
  external_id?: string;
};

/**
 * Cobrança PIX da GORJETA.
 *
 * O vértice da gorjeta roda no **Mercado Pago** (0,99% sem piso) e não no Asaas
 * (R$1,99 fixos, que dá prejuízo abaixo de R$22). O cachê, a assinatura e o
 * saque seguem no Asaas — ver `Docs/_privado/pagamentos/pesquisa-de-gateways-2026-08.md`.
 */
export interface IPixGateway {
  generatePayment(input: PixPaymentRequest): Promise<PixPaymentResponse>;
}
