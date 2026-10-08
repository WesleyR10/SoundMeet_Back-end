import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import {
  EstablishmentPlanTier,
  MusicianPlanTier,
  SubscriptionPersona,
} from "../../../domain/plan-tier.enum";
import { ISubscriptionRepository } from "../../../domain/subscription.repository";
import {
  SubscriptionOutput,
  SubscriptionOutputMapper,
} from "../common/subscription-output";

export type GetActiveSubscriptionInput = {
  persona: SubscriptionPersona;
  entity_id: string;
};

export type GetActiveSubscriptionOutput = {
  /** Tier em vigor — "free" quando não há assinatura ativa (mesma semântica do PlanCheckService). */
  effective_tier: string;
  subscription: SubscriptionOutput | null;
};

export class GetActiveSubscriptionUseCase implements IUseCase<
  GetActiveSubscriptionInput,
  GetActiveSubscriptionOutput
> {
  constructor(private readonly subscriptionRepo: ISubscriptionRepository) {}

  async execute(
    input: GetActiveSubscriptionInput,
  ): Promise<GetActiveSubscriptionOutput> {
    if (!input.entity_id) {
      throw new InvalidArgumentError("entity_id is required");
    }

    const subscription =
      input.persona === "musician"
        ? await this.subscriptionRepo.findActiveMusicianSubscription(
            input.entity_id,
          )
        : await this.subscriptionRepo.findActiveEstablishmentSubscription(
            input.entity_id,
          );

    const freeTier =
      input.persona === "musician"
        ? MusicianPlanTier.FREE
        : EstablishmentPlanTier.FREE;

    return {
      effective_tier: subscription?.isActive()
        ? subscription.plan_tier
        : freeTier,
      subscription: subscription
        ? SubscriptionOutputMapper.toOutput(subscription)
        : null,
    };
  }
}
