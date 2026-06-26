import { PrismaClient } from "@prisma/client";
import {
  Subscription,
  SubscriptionId,
} from "../../../domain/subscription.aggregate";
import { ISubscriptionRepository } from "../../../domain/subscription.repository";
import {
  SubscriptionModel,
  SubscriptionModelMapper,
} from "./subscription-model.mapper";

export class SubscriptionPrismaRepository implements ISubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insert(entity: Subscription): Promise<void> {
    const data = SubscriptionModelMapper.toModel(entity);
    await this.prisma.subscription.create({ data });
  }

  async bulkInsert(entities: Subscription[]): Promise<void> {
    const data = entities.map(SubscriptionModelMapper.toModel);
    await this.prisma.subscription.createMany({ data });
  }

  async update(entity: Subscription): Promise<void> {
    const data = SubscriptionModelMapper.toModel(entity);
    await this.prisma.subscription.update({
      where: { id: entity.subscription_id.id },
      data,
    });
  }

  async delete(entity_id: SubscriptionId): Promise<void> {
    await this.prisma.subscription.delete({ where: { id: entity_id.id } });
  }

  async findById(entity_id: SubscriptionId): Promise<Subscription | null> {
    const model = await this.prisma.subscription.findUnique({
      where: { id: entity_id.id },
    });
    return model
      ? SubscriptionModelMapper.toEntity(model as SubscriptionModel)
      : null;
  }

  async findAll(): Promise<Subscription[]> {
    const models = await this.prisma.subscription.findMany();
    return models.map((m) =>
      SubscriptionModelMapper.toEntity(m as SubscriptionModel),
    );
  }

  async findByIds(ids: SubscriptionId[]): Promise<Subscription[]> {
    const rawIds = ids.map((id) => id.id);
    const models = await this.prisma.subscription.findMany({
      where: { id: { in: rawIds } },
    });
    return models.map((m) =>
      SubscriptionModelMapper.toEntity(m as SubscriptionModel),
    );
  }

  async existsById(
    ids: SubscriptionId[],
  ): Promise<{ exists: SubscriptionId[]; not_exists: SubscriptionId[] }> {
    const rawIds = ids.map((id) => id.id);
    const found = await this.prisma.subscription.findMany({
      where: { id: { in: rawIds } },
      select: { id: true },
    });
    const foundSet = new Set(found.map((r) => r.id));
    return {
      exists: ids.filter((id) => foundSet.has(id.id)),
      not_exists: ids.filter((id) => !foundSet.has(id.id)),
    };
  }

  getEntity(): new (...args: any[]) => Subscription {
    return Subscription;
  }

  async findActiveMusicianSubscription(
    musician_id: string,
  ): Promise<Subscription | null> {
    const model = await this.prisma.subscription.findFirst({
      where: {
        musician_id,
        persona: "musician",
        status: { in: ["active", "trial"] },
      },
      orderBy: { created_at: "desc" },
    });
    return model
      ? SubscriptionModelMapper.toEntity(model as SubscriptionModel)
      : null;
  }

  async findActiveEstablishmentSubscription(
    establishment_id: string,
  ): Promise<Subscription | null> {
    const model = await this.prisma.subscription.findFirst({
      where: {
        establishment_id,
        persona: "establishment",
        status: { in: ["active", "trial"] },
      },
      orderBy: { created_at: "desc" },
    });
    return model
      ? SubscriptionModelMapper.toEntity(model as SubscriptionModel)
      : null;
  }

  async findAllByMusicianId(musician_id: string): Promise<Subscription[]> {
    const models = await this.prisma.subscription.findMany({
      where: { musician_id },
      orderBy: { created_at: "desc" },
    });
    return models.map((m) =>
      SubscriptionModelMapper.toEntity(m as SubscriptionModel),
    );
  }

  async findAllByEstablishmentId(
    establishment_id: string,
  ): Promise<Subscription[]> {
    const models = await this.prisma.subscription.findMany({
      where: { establishment_id },
      orderBy: { created_at: "desc" },
    });
    return models.map((m) =>
      SubscriptionModelMapper.toEntity(m as SubscriptionModel),
    );
  }
}
