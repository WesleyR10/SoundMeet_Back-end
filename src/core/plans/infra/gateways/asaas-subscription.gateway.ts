import axios, { AxiosInstance } from "axios";

import {
  BillingSubscriptionCheckout,
  CreateBillingCustomerInput,
  CreateBillingSubscriptionInput,
  GatewaySubscription,
  ISubscriptionBillingGateway,
  SubscriptionBillingError,
} from "../../application/ports/subscription-billing.gateway";
import { BillingCycle } from "../../domain/plan-tier.enum";

const CYCLE_MAP: Record<BillingCycle, string> = {
  [BillingCycle.MONTHLY]: "MONTHLY",
  [BillingCycle.ANNUAL]: "YEARLY",
};

/**
 * Assinaturas recorrentes via Asaas (POST /v3/subscriptions) — mesma conta e
 * convenções do AsaasGatewayAdapter de saque (header access_token, sandbox
 * por default via ASAAS_API_URL).
 *
 * billingType UNDEFINED: o Asaas gera uma fatura hospedada (invoiceUrl) em que
 * o pagador escolhe PIX/cartão/boleto — evita coletar dados de cartão no app.
 */
export class AsaasSubscriptionGateway implements ISubscriptionBillingGateway {
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

  async createCustomer(
    input: CreateBillingCustomerInput,
  ): Promise<{ gateway_customer_id: string }> {
    try {
      const { data } = await this.http.post("/customers", {
        name: input.name,
        email: input.email,
        cpfCnpj: input.cpf_cnpj.replace(/\D/g, ""),
        externalReference: input.external_reference,
      });
      return { gateway_customer_id: data.id };
    } catch (error) {
      throw new SubscriptionBillingError("Asaas createCustomer failed", error);
    }
  }

  async createSubscription(
    input: CreateBillingSubscriptionInput,
  ): Promise<BillingSubscriptionCheckout> {
    try {
      const { data } = await this.http.post("/subscriptions", {
        customer: input.gateway_customer_id,
        billingType: "UNDEFINED",
        value: input.value_brl,
        nextDueDate: AsaasSubscriptionGateway.tomorrowIsoDate(),
        cycle: CYCLE_MAP[input.cycle],
        description: input.description,
        externalReference: input.external_reference,
      });

      return {
        gateway_subscription_id: data.id,
        checkout_url: await this.firstPaymentInvoiceUrl(data.id),
        status: data.status,
      };
    } catch (error) {
      if (error instanceof SubscriptionBillingError) throw error;
      throw new SubscriptionBillingError(
        "Asaas createSubscription failed",
        error,
      );
    }
  }

  async getSubscription(
    gateway_subscription_id: string,
  ): Promise<GatewaySubscription | null> {
    try {
      const { data } = await this.http.get(
        `/subscriptions/${gateway_subscription_id}`,
      );
      return {
        gateway_subscription_id: data.id,
        external_reference: data.externalReference ?? null,
        status: data.status,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw new SubscriptionBillingError("Asaas getSubscription failed", error);
    }
  }

  async cancelSubscription(gateway_subscription_id: string): Promise<void> {
    try {
      await this.http.delete(`/subscriptions/${gateway_subscription_id}`);
    } catch (error) {
      // Idempotente: já cancelada/inexistente = sucesso (precedente 7.18c).
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 404 || error.response?.status === 410)
      ) {
        return;
      }
      throw new SubscriptionBillingError(
        "Asaas cancelSubscription failed",
        error,
      );
    }
  }

  // A primeira cobrança é criada junto com a assinatura; sua invoiceUrl é a
  // página de pagamento que o app abre. Falha aqui não derruba o checkout —
  // o chamador ainda tem o id da assinatura (URL recuperável depois).
  private async firstPaymentInvoiceUrl(
    subscriptionId: string,
  ): Promise<string | null> {
    try {
      const { data } = await this.http.get(
        `/subscriptions/${subscriptionId}/payments`,
        { params: { limit: 1 } },
      );
      return data?.data?.[0]?.invoiceUrl ?? null;
    } catch {
      return null;
    }
  }

  private static tomorrowIsoDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
}
