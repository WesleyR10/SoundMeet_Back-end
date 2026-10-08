import { IUseCase } from "../../../../shared/application/use-case.interface";
import { Subscription } from "../../../domain/subscription.aggregate";
import { ISubscriptionRepository } from "../../../domain/subscription.repository";
import { ISubscriptionBillingGateway } from "../../ports/subscription-billing.gateway";
import { parseSubscriptionReference } from "../common/subscription-external-reference";

export type ActivateSubscriptionFromPaymentInput = {
  gateway_subscription_id: string;
  /** externalReference que veio no payload do pagamento, se presente. */
  external_reference?: string | null;
  gateway_customer_id?: string | null;
};

export type ActivateSubscriptionFromPaymentOutput = {
  action: "activated" | "renewed" | "ignored";
  subscription_id?: string;
};

/**
 * Chamado pelo webhook a cada pagamento confirmado de uma assinatura no
 * gateway. Idempotência por pagamento fica no chamador (processOnce); aqui a
 * lógica é naturalmente idempotente por estado:
 * - assinatura local já vinculada ao gateway id → renova o ciclo;
 * - primeira confirmação → cria a assinatura local (upgrade real do tier);
 *   se havia outra assinatura ativa (troca de plano), cancela a anterior —
 *   local e best-effort no gateway (cobrança dupla é pior que um cancel a mais).
 * - referência ausente/inválida → "ignored" com log no chamador (nunca lança:
 *   o webhook precisa responder 200 pro gateway não re-entregar eternamente).
 */
export class ActivateSubscriptionFromPaymentUseCase implements IUseCase<
  ActivateSubscriptionFromPaymentInput,
  ActivateSubscriptionFromPaymentOutput
> {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly billingGateway: ISubscriptionBillingGateway,
  ) {}

  async execute(
    input: ActivateSubscriptionFromPaymentInput,
  ): Promise<ActivateSubscriptionFromPaymentOutput> {
    if (!input.gateway_subscription_id) {
      return { action: "ignored" };
    }

    const existing = await this.subscriptionRepo.findByGatewaySubscriptionId(
      input.gateway_subscription_id,
    );
    if (existing) {
      existing.renew();
      await this.subscriptionRepo.update(existing);
      return {
        action: "renewed",
        subscription_id: existing.subscription_id.id,
      };
    }

    let reference = parseSubscriptionReference(input.external_reference);
    if (!reference) {
      // Payload sem referência utilizável — busca a assinatura no gateway
      // (fonte autoritativa do externalReference que o checkout gravou).
      const gatewaySub = await this.billingGateway.getSubscription(
        input.gateway_subscription_id,
      );
      reference = parseSubscriptionReference(gatewaySub?.external_reference);
    }
    if (!reference) {
      return { action: "ignored" };
    }

    const current =
      reference.persona === "musician"
        ? await this.subscriptionRepo.findActiveMusicianSubscription(
            reference.entity_id,
          )
        : await this.subscriptionRepo.findActiveEstablishmentSubscription(
            reference.entity_id,
          );

    if (current) {
      current.cancel();
      await this.subscriptionRepo.update(current);
      if (
        current.gateway_subscription_id &&
        current.gateway_subscription_id !== input.gateway_subscription_id
      ) {
        try {
          await this.billingGateway.cancelSubscription(
            current.gateway_subscription_id,
          );
        } catch {
          // Best-effort: falha aqui não pode impedir a ativação do plano novo;
          // a assinatura antiga órfã no gateway é reconciliável manualmente.
        }
      }
    }

    const subscription = Subscription.create({
      musician_id:
        reference.persona === "musician" ? reference.entity_id : undefined,
      establishment_id:
        reference.persona === "establishment" ? reference.entity_id : undefined,
      plan_tier: reference.plan_tier,
      persona: reference.persona,
      billing_cycle: reference.billing_cycle,
      gateway_customer_id: input.gateway_customer_id ?? undefined,
      gateway_subscription_id: input.gateway_subscription_id,
    });
    await this.subscriptionRepo.insert(subscription);

    return {
      action: "activated",
      subscription_id: subscription.subscription_id.id,
    };
  }
}
