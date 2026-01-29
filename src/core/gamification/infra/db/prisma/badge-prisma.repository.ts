import { PrismaClient } from "@prisma/client";

import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { Badge, BadgeId } from "../../../domain/badge.aggregate";
import { IBadgeRepository } from "../../../domain/badge.repository";
import {
  BadgeSearchParams,
  BadgeSearchResult,
} from "../../../domain/badge.repository";
import { BadgeModelMapper } from "./badge-model-mapper";

export class BadgePrismaRepository implements IBadgeRepository {
  sortableFields: string[] = ["name", "points", "created_at"];

  constructor(private prismaClient: PrismaClient) {}

  async insert(entity: Badge): Promise<void> {
    const model = BadgeModelMapper.toModel(entity);
    try {
      await this.prismaClient.badge.create({
        data: model,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: Badge,
        id: entity.badge_id.id,
        operation: "badge.create",
      });
    }
  }

  async bulkInsert(entities: Badge[]): Promise<void> {
    const models = entities.map((entity) => BadgeModelMapper.toModel(entity));
    try {
      await this.prismaClient.badge.createMany({
        data: models,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: Badge,
        operation: "badge.createMany",
      });
    }
  }

  async update(entity: Badge): Promise<void> {
    const model = BadgeModelMapper.toModel(entity);
    const { id: _id, created_at: _created_at, ...data } = model as any;
    try {
      await this.prismaClient.badge.update({
        where: { id: entity.badge_id.id },
        data,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: Badge,
        id: entity.badge_id.id,
        operation: "badge.update",
      });
    }
  }

  async delete(id: BadgeId): Promise<void> {
    try {
      await this.prismaClient.badge.delete({
        where: { id: id.id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: Badge,
        id: id.id,
        operation: "badge.delete",
      });
    }
  }

  async findById(id: BadgeId): Promise<Badge | null> {
    const model = await this.prismaClient.badge.findUnique({
      where: { id: id.id },
    });

    return model ? BadgeModelMapper.toEntity(model) : null;
  }

  async findByIds(ids: BadgeId[]): Promise<Badge[]> {
    const models = await this.prismaClient.badge.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((model) => BadgeModelMapper.toEntity(model));
  }

  async findAll(): Promise<Badge[]> {
    const models = await this.prismaClient.badge.findMany();
    return models.map((model) => BadgeModelMapper.toEntity(model));
  }

  async existsById(
    ids: BadgeId[],
  ): Promise<{ exists: BadgeId[]; not_exists: BadgeId[] }> {
    const existingModels = await this.prismaClient.badge.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });

    const existingIds = existingModels.map((model) => model.id);
    const exists = ids.filter((id) => existingIds.includes(id.id));
    const not_exists = ids.filter((id) => !existingIds.includes(id.id));

    return { exists, not_exists };
  }

  async search(props: BadgeSearchParams): Promise<BadgeSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where: any = {};

    if (props.filter) {
      if (props.filter.name) {
        where.OR = [
          { name: { contains: props.filter.name, mode: "insensitive" } },
          { description: { contains: props.filter.name, mode: "insensitive" } },
        ];
      }

      if (props.filter.category) {
        where.category = props.filter.category;
      }

      if (props.filter.rarity) {
        where.rarity = props.filter.rarity;
      }

      if (
        props.filter.is_active !== undefined &&
        props.filter.is_active !== null
      ) {
        where.is_active = props.filter.is_active;
      }
    }

    const orderBy: any = {};
    if (props.sort && this.sortableFields.includes(props.sort)) {
      orderBy[props.sort] = props.sort_dir || "asc";
    } else {
      orderBy.created_at = "desc";
    }

    const [models, count] = await Promise.all([
      this.prismaClient.badge.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prismaClient.badge.count({ where }),
    ]);

    const items = models.map((model) => BadgeModelMapper.toEntity(model));

    return new BadgeSearchResult({
      items,
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  async findByCategory(category: string): Promise<Badge[]> {
    const models = await this.prismaClient.badge.findMany({
      where: { category },
    });

    return models.map((model) => BadgeModelMapper.toEntity(model));
  }

  async findByRarity(rarity: string): Promise<Badge[]> {
    const models = await this.prismaClient.badge.findMany({
      where: { rarity },
    });

    return models.map((model) => BadgeModelMapper.toEntity(model));
  }

  async findActiveOnly(): Promise<Badge[]> {
    const models = await this.prismaClient.badge.findMany({
      where: { is_active: true },
    });

    return models.map((model) => BadgeModelMapper.toEntity(model));
  }

  getEntity(): new (...args: any[]) => Badge {
    return Badge;
  }
}
