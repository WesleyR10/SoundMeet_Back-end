import {
  BillingSubscriptionCheckout,
  CreateBillingCustomerInput,
  CreateBillingSubscriptionInput,
  GatewaySubscription,
  ISubscriptionBillingGateway,
} from "../../application/ports/subscription-billing.gateway";

/**
 * Fake em memória — usado nos testes e como binding de dev quando
 * ASAAS_API_KEY não está configurada (mesmo precedente do PixGatewayMock).
 */
export class FakeSubscriptionBillingGateway implements ISubscriptionBillingGateway {
  customers: Array<
    CreateBillingCustomerInput & { gateway_customer_id: string }
  > = [];
  subscriptions = new Map<
    string,
    CreateBillingSubscriptionInput & { status: string }
  >();
  cancelled: string[] = [];

  private seq = 0;

  async createCustomer(
    input: CreateBillingCustomerInput,
  ): Promise<{ gateway_customer_id: string }> {
    const gateway_customer_id = `fake_cus_${++this.seq}`;
    this.customers.push({ ...input, gateway_customer_id });
    return { gateway_customer_id };
  }

  async createSubscription(
    input: CreateBillingSubscriptionInput,
  ): Promise<BillingSubscriptionCheckout> {
    const gateway_subscription_id = `fake_sub_${++this.seq}`;
    this.subscriptions.set(gateway_subscription_id, {
      ...input,
      status: "ACTIVE",
    });
    return {
      gateway_subscription_id,
      checkout_url: `https://sandbox.asaas.com/fake-checkout/${gateway_subscription_id}`,
      status: "ACTIVE",
    };
  }

  async getSubscription(
    gateway_subscription_id: string,
  ): Promise<GatewaySubscription | null> {
    const sub = this.subscriptions.get(gateway_subscription_id);
    if (!sub) return null;
    return {
      gateway_subscription_id,
      external_reference: sub.external_reference,
      status: sub.status,
    };
  }

  async cancelSubscription(gateway_subscription_id: string): Promise<void> {
    this.cancelled.push(gateway_subscription_id);
    const sub = this.subscriptions.get(gateway_subscription_id);
    if (sub) {
      sub.status = "CANCELLED";
    }
  }
}
