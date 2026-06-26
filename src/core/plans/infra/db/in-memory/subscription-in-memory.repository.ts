import { InMemoryRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
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
}
