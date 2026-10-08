import { randomUUID } from "node:crypto";

import axios, { AxiosInstance } from "axios";

import {
  IMercadoPagoAccountResolver,
  MercadoPagoAccountNotLinkedError,
} from "./mercadopago-account.resolver";
import {
  IPixGateway,
  PixPaymentRequest,
  PixPaymentResponse,
} from "./pix-gateway.interface";

/**
 * Gorjeta via PIX no Mercado Pago.
 *
 * ## Por que o MP e não o Asaas neste vértice
 *
 * 0,99% **sem piso**, contra R$1,99 **fixos** do Asaas. Num ticket de R$5–60 a
 * diferença não é de margem: com taxa fixa, o ponto de equilíbrio da plataforma
 * vai para R$22 no plano FREE e toda gorjeta de bar dá prejuízo. Ver
 * `Docs/_privado/pagamentos/pesquisa-de-gateways-2026-08.md`.
 *
 * ## A cobrança é criada na conta DO MÚSICO
 *
 * 🔴 É o ponto inteiro da escolha. O `POST /v1/orders` sai autenticado com o
 * **access token dele** (obtido por OAuth), e a comissão da plataforma sai por
 * `marketplace_fee` (Orders API; o equivalente de `application_fee` no
 * Payments API). Resultado: o dinheiro nunca transita pelo patrimônio da
 * SoundMeet — mesma postura da subconta Asaas, e o que a premissa fundamental
 * de `decisoes-de-gateway.md` exige ("fundos ficam na IP autorizada, não
 * na conta SoundMeet").
 *
 * Usar o token da plataforma aqui "porque é mais simples" faria o dinheiro cair
 * na nossa conta e transformaria a gorjeta em custódia de recurso de terceiro.
 */
export class MercadoPagoPixGateway implements IPixGateway {
  private readonly http: AxiosInstance;

  constructor(
    apiUrl: string,
    private readonly accounts: IMercadoPagoAccountResolver,
  ) {
    this.http = axios.create({
      baseURL: apiUrl,
      headers: { "Content-Type": "application/json" },
      timeout: 30_000,
    });
  }

  async generatePayment(input: PixPaymentRequest): Promise<PixPaymentResponse> {
    if (!input.beneficiary_musician_id) {
      throw new MercadoPagoAccountNotLinkedError("desconhecido");
    }

    const account = await this.accounts.resolve(input.beneficiary_musician_id);
    if (!account) {
      throw new MercadoPagoAccountNotLinkedError(input.beneficiary_musician_id);
    }

    /*
     * Orders API (`POST /v1/orders`), não Payments API (`POST /v1/payments`).
     *
     * Credencial `TEST-` da app (SoundMeetPIX) é recusada aqui com
     * `invalid_credentials` — o MP exige test *user* com token `APP_USR-`
     * (o OAuth do músico). Payments API aceita `TEST-`; não é motivo para
     * trocar este gateway. 29/ago: `POST /v1/orders` com o vendedor de
     * sandbox devolveu 201 + QR PIX.
     *
     * A comissão sai por `marketplace_fee` (string decimal), o equivalente
     * OAuth de `application_fee`. Sem o músico ter autorizado o app, o MP
     * aceita o campo e ignora — a cobrança nasce, a taxa da plataforma não.
     * Por isso o vínculo OAuth não é opcional: sem ele a tabela de preços
     * mente. O valor vem PRONTO do use-case (`splitAmountInCents`); recalcular
     * em ponto flutuante aqui devolveria `1111.1000000000001`.
     *
     * `external_reference` carrega o `tip_id`. A Orders API recusa `metadata`
     * no body; o pagamento gerado copia a referência, e o reader mapeia de
     * volta para `metadata.tip_id` na hora do webhook.
     */
    const amount = Number(input.amount).toFixed(2);
    const platformFee = Number(input.platform_fee ?? 0);
    const tipId = input.metadata?.tip_id;

    const body: Record<string, unknown> = {
      type: "online",
      processing_mode: "automatic",
      total_amount: amount,
      payer: {
        email: input.payer?.email ?? "gorjeta@soundmeet.com.br",
        first_name: input.payer?.name ?? undefined,
      },
      transactions: {
        payments: [
          {
            amount,
            payment_method: {
              id: "pix",
              type: "bank_transfer",
            },
          },
        ],
      },
    };

    if (tipId) {
      body.external_reference = String(tipId);
    }

    if (platformFee > 0) {
      body.marketplace_fee = platformFee.toFixed(2);
    }

    const { data } = await this.http.post("/v1/orders", body, {
      headers: {
        // 🔑 Token DELE, não o nosso — é o que faz o dinheiro liquidar na
        // conta do músico.
        Authorization: `Bearer ${account.access_token}`,
        /*
         * O MP exige idempotência nesta rota, e uma chave por chamada é o
         * bastante aqui: o retry de rede é do axios (que não repete POST por
         * padrão), e o `tip_id` já garante unicidade do lado do domínio.
         */
        "X-Idempotency-Key": randomUUID(),
      },
    });

    const pix = data?.transactions?.payments?.[0]?.payment_method;

    return {
      qr_code: pix?.qr_code_base64 ?? "",
      copy_paste_code: pix?.qr_code ?? "",
      external_id: extractNumericPaymentId(pix?.ticket_url, data?.id),
    };
  }
}

/**
 * O webhook do MP notifica o id NUMÉRICO do pagamento (`1739…`), não o
 * `ORDTST…` / `PAY01…` da Orders API. Sem esse parse o `external_id` da
 * gorjeta não casaria com `data.id` da notificação.
 */
function extractNumericPaymentId(
  ticketUrl: string | undefined,
  orderId: unknown,
): string {
  const match = String(ticketUrl ?? "").match(/\/payments\/(\d+)/);
  if (match) {
    return match[1];
  }
  return String(orderId ?? "");
}
