import { BillingCycle } from "../../domain/plan-tier.enum";

export type CreateBillingCustomerInput = {
  name: string;
  email: string;
  /** CPF ou CNPJ do pagador — obrigatório no Asaas. Aceita com ou sem máscara. */
  cpf_cnpj: string;
  external_reference?: string;
};

export type CreateBillingSubscriptionInput = {
  gateway_customer_id: string;
  value_brl: number;
  cycle: BillingCycle;
  description: string;
  /**
   * Referência opaca que volta em todo webhook de pagamento desta assinatura —
   * carrega persona/entidade/tier/ciclo (ver subscription-external-reference.ts).
   */
  external_reference: string;
};

export type BillingSubscriptionCheckout = {
  gateway_subscription_id: string;
  /** URL da fatura hospedada do gateway onde o usuário escolhe PIX/cartão. */
  checkout_url: string | null;
  status: string;
};

export type GatewaySubscription = {
  gateway_subscription_id: string;
  external_reference: string | null;
  status: string;
};

export class SubscriptionBillingError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SubscriptionBillingError";
  }
}

export interface ISubscriptionBillingGateway {
  createCustomer(
    input: CreateBillingCustomerInput,
  ): Promise<{ gateway_customer_id: string }>;

  createSubscription(
    input: CreateBillingSubscriptionInput,
  ): Promise<BillingSubscriptionCheckout>;

  getSubscription(
    gateway_subscription_id: string,
  ): Promise<GatewaySubscription | null>;

  /** Idempotente: cancelar assinatura já cancelada/inexistente não é erro. */
  cancelSubscription(gateway_subscription_id: string): Promise<void>;
}
