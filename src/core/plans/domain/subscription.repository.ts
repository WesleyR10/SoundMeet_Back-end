import { IRepository } from "../../shared/domain/repository/repository-interface";
import { Subscription, SubscriptionId } from "./subscription.aggregate";

export interface ISubscriptionRepository
  extends IRepository<Subscription, SubscriptionId> {
  findActiveMusicianSubscription(
    musician_id: string,
  ): Promise<Subscription | null>;
  findActiveEstablishmentSubscription(
    establishment_id: string,
  ): Promise<Subscription | null>;
  findAllByMusicianId(musician_id: string): Promise<Subscription[]>;
  findAllByEstablishmentId(
    establishment_id: string,
  ): Promise<Subscription[]>;
}
