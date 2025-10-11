import { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
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
    await this.prismaClient.badge.create({
      data: model,
    });
  }

  async bulkInsert(entities: Badge[]): Promise<void> {
    const models = entities.map((entity) => BadgeModelMapper.toModel(entity));
    await this.prismaClient.badge.createMany({
      data: models,
    });
  }

  async update(entity: Badge): Promise<void> {
    const model = BadgeModelMapper.toModel(entity);
    try {
      await this.prismaClient.badge.update({
        where: { id: entity.id.id },
        data: model,
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(entity.id.id, Badge);
      }
      throw error;
    }
  }

  async delete(id: BadgeId): Promise<void> {
    try {
      await this.prismaClient.badge.delete({
        where: { id: id.id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(id.id, Badge);
      }
      throw error;
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

    const [models, count] = await Promise.all([
      this.prismaClient.badge.findMany({
        where,
        orderBy: props.sort ? { [props.sort]: props.sort_dir } : undefined,
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
