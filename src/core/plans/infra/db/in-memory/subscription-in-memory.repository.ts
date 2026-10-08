import { InMemoryRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { MusicianPlanTier } from "../../../domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionId,
  SubscriptionStatus,
} from "../../../domain/subscription.aggregate";
import { ISubscriptionRepository } from "../../../domain/subscription.repository";

export class SubscriptionInMemoryRepository
  extends InMemoryRepository<Subscription, SubscriptionId>
  implements ISubscriptionRepository
{
  getEntity(): new (...args: any[]) => Subscription {
    return Subscription;
  }

  async findActiveMusicianSubscription(
    musician_id: string,
  ): Promise<Subscription | null> {
    return (
      this.items.find(
        (s) =>
          s.musician_id === musician_id &&
          s.persona === "musician" &&
          s.isActive(),
      ) ?? null
    );
  }

  async findActiveEstablishmentSubscription(
    establishment_id: string,
  ): Promise<Subscription | null> {
    return (
      this.items.find(
        (s) =>
          s.establishment_id === establishment_id &&
          s.persona === "establishment" &&
          s.isActive(),
      ) ?? null
    );
  }

  async findAllByMusicianId(musician_id: string): Promise<Subscription[]> {
    return this.items.filter((s) => s.musician_id === musician_id);
  }

  async findAllByEstablishmentId(
    establishment_id: string,
  ): Promise<Subscription[]> {
    return this.items.filter((s) => s.establishment_id === establishment_id);
  }

  async findByGatewaySubscriptionId(
    gateway_subscription_id: string,
  ): Promise<Subscription | null> {
    return (
      this.items.find(
        (s) => s.gateway_subscription_id === gateway_subscription_id,
      ) ?? null
    );
  }

  async findActivePaidMusicianIds(): Promise<string[]> {
    const ids = this.items
      .filter(
        (s) =>
          s.persona === "musician" &&
          s.musician_id !== null &&
          (s.status === SubscriptionStatus.ACTIVE ||
            s.status === SubscriptionStatus.TRIAL) &&
          // FREE excluído explicitamente: `plan_tier` não tem constraint, e
          // uma linha órfã de tier gratuito compraria destaque de graça.
          s.plan_tier !== MusicianPlanTier.FREE,
      )
      .map((s) => s.musician_id as string);

    // Um músico pode ter mais de uma linha vigente (upgrade no mesmo ciclo);
    // o destaque é por PESSOA, não por assinatura.
    return [...new Set(ids)];
  }
}
