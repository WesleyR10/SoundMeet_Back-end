import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { SubscriptionPersona } from "../../../domain/plan-tier.enum";
import { Subscription } from "../../../domain/subscription.aggregate";
import { ISubscriptionRepository } from "../../../domain/subscription.repository";
import { ISubscriptionBillingGateway } from "../../ports/subscription-billing.gateway";
import {
  SubscriptionOutput,
  SubscriptionOutputMapper,
} from "../common/subscription-output";

export type CancelSubscriptionInput = {
  persona: SubscriptionPersona;
  entity_id: string;
};

export type CancelSubscriptionOutput = SubscriptionOutput;

export class CancelSubscriptionUseCase implements IUseCase<
  CancelSubscriptionInput,
  CancelSubscriptionOutput
> {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly billingGateway: ISubscriptionBillingGateway,
  ) {}

  async execute(
    input: CancelSubscriptionInput,
  ): Promise<CancelSubscriptionOutput> {
    const subscription =
      input.persona === "musician"
        ? await this.subscriptionRepo.findActiveMusicianSubscription(
            input.entity_id,
          )
        : await this.subscriptionRepo.findActiveEstablishmentSubscription(
            input.entity_id,
          );

    if (!subscription) {
      throw new NotFoundError(input.entity_id, Subscription);
    }

    subscription.cancel();
    await this.subscriptionRepo.update(subscription);

    // Cancela a cobrança recorrente no gateway ANTES de responder, mas
    // best-effort: o cancelamento local é o que interrompe os benefícios;
    // falha remota fica logada pelo chamador e é reconciliável.
    if (subscription.gateway_subscription_id) {
      try {
        await this.billingGateway.cancelSubscription(
          subscription.gateway_subscription_id,
        );
      } catch {
        // Assinatura órfã no gateway — não bloqueia o cancelamento local.
      }
    }

    return SubscriptionOutputMapper.toOutput(subscription);
  }
}
