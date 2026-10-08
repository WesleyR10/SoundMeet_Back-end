/**
 * Fluxo OAuth do marketplace Mercado Pago.
 *
 * É o que permite criar a cobrança **na conta do músico** — sem isso o dinheiro
 * cairia na conta da plataforma, que é custódia de recurso de terceiro.
 */

export type MercadoPagoTokens = {
  mp_user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
};

export interface IMercadoPagoOAuthGateway {
  /**
   * URL para onde mandar o músico autorizar.
   *
   * 🔴 Precisa pedir `offline_access`. Sem esse escopo o provedor **não devolve
   * `refresh_token`**, e o vínculo morre em 180 dias exigindo reautorização
   * manual — provavelmente descoberta quando uma gorjeta falhar, no palco.
   */
  buildAuthorizationUrl(state: string): string;

  /** Troca o `code` do callback pelo par de tokens. */
  exchangeCode(code: string): Promise<MercadoPagoTokens>;

  /** Renova antes do vencimento, sem interação do usuário. */
  refresh(refreshToken: string): Promise<MercadoPagoTokens>;
}

/**
 * Leitura de uma cobrança no Mercado Pago.
 *
 * O webhook do MP notifica **só o id**. O valor, o status e a metadata (onde
 * vive o `tip_id`) vêm de consultar a API — e com o token do VENDEDOR, porque a
 * cobrança mora na conta dele. É por isso que o webhook precisa antes resolver
 * o `user_id` da notificação para uma carteira.
 */
export type MercadoPagoPayment = {
  id: string;
  status: string;
  transaction_amount: number;
  /** Taxa total retida pelo provedor (para o lançamento na `Transaction`). */
  fee_amount: number;
  /** `tip_id` viaja aqui desde a criação da cobrança. */
  metadata: Record<string, any>;
};

export interface IMercadoPagoPaymentReader {
  getPayment(
    paymentId: string,
    accessToken: string,
  ): Promise<MercadoPagoPayment>;
}
