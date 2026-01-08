import { PrismaClient } from "@prisma/client";

import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { UserBadge, UserBadgeId } from "../../../domain/user-badge.aggregate";
import { IUserBadgeRepository } from "../../../domain/user-badge.repository";
import {
  UserBadgeSearchParams,
  UserBadgeSearchResult,
} from "../../../domain/user-badge.repository";
import { UserBadgeModelMapper } from "./user-badge-model-mapper";

export class UserBadgePrismaRepository implements IUserBadgeRepository {
  sortableFields: string[] = ["earnedAt", "progress"];

  constructor(private prismaClient: PrismaClient) {}

  async insert(entity: UserBadge): Promise<void> {
    const model = UserBadgeModelMapper.toModel(entity);
    // Convertendo para o formato Prisma
    await this.prismaClient.userBadge.create({
      data: {
        id: model.id,
        audienceId: model.user_id,
        badgeId: model.badge_type,
        earnedAt: model.created_at,
        progress: model.progress,
      },
    });
  }

  async bulkInsert(entities: UserBadge[]): Promise<void> {
    const models = entities.map((entity) => {
      const model = UserBadgeModelMapper.toModel(entity);
      return {
        id: model.id,
        audienceId: model.user_id,
        badgeId: model.badge_type,
        earnedAt: model.created_at,
        progress: model.progress,
      };
    });
    await this.prismaClient.userBadge.createMany({
      data: models,
    });
  }

  async update(entity: UserBadge): Promise<void> {
    const model = UserBadgeModelMapper.toModel(entity);
    try {
      await this.prismaClient.userBadge.update({
        where: { id: entity.user_badge_id.id },
        data: {
          audienceId: model.user_id,
          badgeId: model.badge_type,
          earnedAt: model.created_at,
          progress: model.progress,
        },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(entity.user_badge_id.id, UserBadge);
      }
      throw error;
    }
  }

  async delete(id: UserBadgeId): Promise<void> {
    try {
      await this.prismaClient.userBadge.delete({
        where: { id: id.id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(id.id, UserBadge);
      }
      throw error;
    }
  }

  async findById(id: UserBadgeId): Promise<UserBadge | null> {
    const model = await this.prismaClient.userBadge.findUnique({
      where: { id: id.id },
    });
    return model ? UserBadgeModelMapper.toEntity(model) : null;
  }

  async findAll(): Promise<UserBadge[]> {
    const models = await this.prismaClient.userBadge.findMany({
      orderBy: { earnedAt: "desc" },
    });
    return models.map((model) => UserBadgeModelMapper.toEntity(model));
  }

  async findByIds(ids: UserBadgeId[]): Promise<UserBadge[]> {
    const models = await this.prismaClient.userBadge.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((model) => UserBadgeModelMapper.toEntity(model));
  }

  async existsById(
    ids: UserBadgeId[],
  ): Promise<{ exists: UserBadgeId[]; not_exists: UserBadgeId[] }> {
    const existingModels = await this.prismaClient.userBadge.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });

    const existingIds = existingModels.map((model) => model.id);
    const exists = ids.filter((id) => existingIds.includes(id.id));
    const not_exists = ids.filter((id) => !existingIds.includes(id.id));

    return { exists, not_exists };
  }

  getEntity(): new (...args: any[]) => UserBadge {
    return UserBadge;
  }

  async search(props: UserBadgeSearchParams): Promise<UserBadgeSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where: any = {};

    if (props.filter) {
      if (props.filter.user_id) {
        where.audienceId = props.filter.user_id;
      }
      if (props.filter.badge_type) {
        where.badgeId = props.filter.badge_type;
      }
      // Note: is_unlocked e progress não existem no schema Prisma atual
      // Estes filtros serão ignorados por enquanto
    }

    const orderBy: any = {};
    if (props.sort && this.sortableFields.includes(props.sort)) {
      orderBy[props.sort] = props.sort_dir || "desc";
    } else {
      orderBy.earnedAt = "desc";
    }

    const [models, count] = await Promise.all([
      this.prismaClient.userBadge.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prismaClient.userBadge.count({ where }),
    ]);

    const items = models.map((model) => UserBadgeModelMapper.toEntity(model));

    return new UserBadgeSearchResult({
      items,
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  async findByUserId(user_id: string): Promise<UserBadge[]> {
    const models = await this.prismaClient.userBadge.findMany({
      where: { audienceId: user_id },
      orderBy: { earnedAt: "desc" },
    });
    return models.map((model) => UserBadgeModelMapper.toEntity(model));
  }

  async findByUserAndBadgeType(
    user_id: string,
    badge_type: string,
  ): Promise<UserBadge | null> {
    const model = await this.prismaClient.userBadge.findFirst({
      where: { audienceId: user_id, badgeId: badge_type },
    });
    return model ? UserBadgeModelMapper.toEntity(model) : null;
  }

  async findUnlockedByUser(user_id: string): Promise<UserBadge[]> {
    // Como não temos is_unlocked no schema, vamos considerar todos como "unlocked"
    const models = await this.prismaClient.userBadge.findMany({
      where: { audienceId: user_id },
      orderBy: { earnedAt: "desc" },
    });
    return models.map((model) => UserBadgeModelMapper.toEntity(model));
  }

  async findInProgressByUser(user_id: string): Promise<UserBadge[]> {
    // Como não temos is_unlocked no schema, retornamos array vazio por enquanto
    return [];
  }
}
