import axios, { AxiosInstance } from "axios";

import {
  EscrowChargeRequest,
  EscrowChargeResponse,
  IBookingEscrowGateway,
} from "./booking-escrow-gateway.interface";

/**
 * Custódia via Conta Escrow do Asaas.
 *
 * Molde de `asaas-gateway.adapter.ts` (mesmo header `access_token`, mesmo
 * timeout, mesmo `externalReference`) — dois clientes HTTP com convenções
 * diferentes para o mesmo provedor é o começo de uma divergência.
 *
 * ## O que este adapter NÃO faz
 *
 * Não habilita a Conta Escrow — isso é `ISubaccountGateway.configureEscrow`, e
 * a separação é deliberada: habilitar custa mensalidade por subconta e
 * desabilitar libera o que está retido, então é decisão de domínio sobre a
 * carteira, não efeito colateral de criar uma cobrança.
 */
export class AsaasEscrowAdapter implements IBookingEscrowGateway {
  private readonly http: AxiosInstance;

  constructor(apiUrl: string, apiKey: string) {
    this.http = axios.create({
      baseURL: apiUrl,
      headers: {
        access_token: apiKey,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
  }

  async createEscrowCharge(
    input: EscrowChargeRequest,
  ): Promise<EscrowChargeResponse> {
    /*
     * `split` manda o valor para a subconta do MÚSICO — é o que faz o dinheiro
     * não passar pela conta da plataforma. A comissão fica na principal por
     * diferença, e não por um segundo lançamento: um split de duas pernas
     * poderia arredondar de formas diferentes e deixar centavo órfão.
     */
    const { data } = await this.http.post("/payments", {
      billingType: "PIX",
      value: input.amount,
      dueDate: (input.due_date ?? new Date()).toISOString().slice(0, 10),
      description: input.description ?? "Cachê de apresentação — SoundMeet",
      externalReference: input.external_reference,
      split: [
        {
          // `net_amount` vem pronto do domínio (`splitAmountInCents`).
          // Recalcular aqui seria a segunda conta sobre o mesmo dinheiro.
          walletId: input.beneficiary_wallet_id,
          fixedValue: input.net_amount,
        },
      ],
    });

    return {
      external_id: data.id,
      status: data.status,
      /*
       * O provedor devolve a data em que a garantia expira quando a Conta
       * Escrow está ligada na subconta. Ausente significa que a custódia NÃO
       * está ativa — o chamador precisa notar, porque emitir contrato com
       * cláusula de custódia sobre um pagamento sem custódia é afirmar em
       * documento algo que não acontece.
       */
      expires_at: data.escrow?.expirationDate
        ? new Date(data.escrow.expirationDate)
        : null,
      payment_payload: data.encodedImage ?? data.payload ?? null,
    };
  }

  /**
   * `GET /payments?externalReference=...` — a cobrança que talvez já exista.
   *
   * Devolve a primeira não cancelada: o provedor aceita mais de uma cobrança
   * com a mesma referência, e uma cancelada não serve como "já cobrado".
   */
  async findChargeByReference(
    externalReference: string,
  ): Promise<EscrowChargeResponse | null> {
    const { data } = await this.http.get("/payments", {
      params: { externalReference, limit: 10 },
    });

    const charge = (data?.data ?? []).find(
      (item: { status?: string }) =>
        item.status !== "REFUNDED" && item.status !== "CANCELLED",
    );
    if (!charge) return null;

    return {
      external_id: charge.id,
      status: charge.status,
      expires_at: charge.escrow?.expirationDate
        ? new Date(charge.escrow.expirationDate)
        : null,
      payment_payload: charge.encodedImage ?? charge.payload ?? null,
    };
  }

  async releaseEscrow(externalId: string): Promise<void> {
    await this.http.post(`/payments/${externalId}/escrow/finish`, {});
  }

  async refundEscrow(externalId: string, reason: string): Promise<void> {
    await this.http.post(`/payments/${externalId}/refund`, {
      description: reason,
    });
  }
}
