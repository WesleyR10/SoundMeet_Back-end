import axios, { AxiosInstance } from "axios";

import {
  IMercadoPagoOAuthGateway,
  IMercadoPagoPaymentReader,
  MercadoPagoPayment,
  MercadoPagoTokens,
} from "./mercadopago-oauth.gateway";

export type MercadoPagoOAuthConfig = {
  apiUrl: string;
  authUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export class MercadoPagoOAuthAdapter
  implements IMercadoPagoOAuthGateway, IMercadoPagoPaymentReader
{
  private readonly http: AxiosInstance;

  constructor(private readonly config: MercadoPagoOAuthConfig) {
    this.http = axios.create({
      baseURL: config.apiUrl,
      headers: { "Content-Type": "application/json" },
      timeout: 30_000,
    });
  }

  buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      platform_id: "mp",
      redirect_uri: this.config.redirectUri,
      /*
       * 🔴 Sem isto o MP nunca devolve `refresh_token` — o comentário em
       * `mercadopago-oauth.gateway.ts` já avisava, o parâmetro é que faltava.
       * `toTokens` falha alto quando `refresh_token` vem ausente, então sem
       * este escopo NENHUM músico conseguiria vincular a conta.
       */
      scope: "offline_access",
      state,
    });

    return `${this.config.authUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<MercadoPagoTokens> {
    const { data } = await this.http.post("/oauth/token", {
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.redirectUri,
    });

    return this.toTokens(data);
  }

  async refresh(refreshToken: string): Promise<MercadoPagoTokens> {
    const { data } = await this.http.post("/oauth/token", {
      grant_type: "refresh_token",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken,
    });

    return this.toTokens(data);
  }

  /**
   * Lê a cobrança com o token do VENDEDOR — ela mora na conta dele.
   *
   * `fee_details` traz as taxas cobradas pelo provedor; somá-las é o que
   * permite lançar a `Transaction` com o líquido correto em vez de supor a
   * alíquota.
   */
  async getPayment(
    paymentId: string,
    accessToken: string,
  ): Promise<MercadoPagoPayment> {
    const { data } = await this.http.get(`/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const feeAmount = Array.isArray(data?.fee_details)
      ? data.fee_details.reduce(
          (total: number, fee: any) => total + Number(fee?.amount ?? 0),
          0,
        )
      : 0;

    /*
     * A Orders API não aceita `metadata` na criação; o `tip_id` viaja em
     * `external_reference` e o pagamento copia o campo. O webhook continua
     * lendo `metadata.tip_id` — então o mapeamento acontece AQUI, na borda,
     * e não espalha o detalhe do provedor pelo controller.
     */
    const metadata = {
      ...(data?.metadata ?? {}),
    };
    if (metadata.tip_id == null && data?.external_reference) {
      metadata.tip_id = data.external_reference;
    }

    return {
      id: String(data?.id ?? paymentId),
      status: String(data?.status ?? "unknown"),
      transaction_amount: Number(data?.transaction_amount ?? 0),
      fee_amount: feeAmount,
      metadata,
    };
  }

  /**
   * 🔴 Falha ALTO quando falta `refresh_token`.
   *
   * Devolver o par sem ele persistiria um vínculo que morre em 180 dias sem
   * aviso — e o sintoma apareceria como "a gorjeta parou de funcionar", meses
   * depois, sem ninguém ligar à autorização. Um erro aqui custa uma
   * retentativa; um vínculo sem refresh custa a conta inteira.
   *
   * A causa quase sempre é o escopo `offline_access` faltando na URL de
   * autorização.
   */
  private toTokens(data: any): MercadoPagoTokens {
    if (!data?.user_id || !data?.access_token || !data?.refresh_token) {
      throw new Error(
        "Mercado Pago não devolveu user_id/access_token/refresh_token — confira o escopo offline_access",
      );
    }

    /*
     * `expires_in` vem em SEGUNDOS. Tratá-lo como milissegundos daria um
     * vencimento no passado e o job renovaria em loop; o contrário deixaria o
     * token vencer sem ninguém renovar. Mesma família da armadilha de TTL do
     * cache-manager já registrada no projeto.
     */
    const expiresInSeconds = Number(data.expires_in ?? 0);

    return {
      mp_user_id: String(data.user_id),
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }
}
