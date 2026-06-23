import { PrismaClient } from "@prisma/client";

import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { UserBadge, UserBadgeId } from "../../../domain/user-badge.aggregate";
import { IUserBadgeRepository } from "../../../domain/user-badge.repository";
import {
  UserBadgeSearchParams,
  UserBadgeSearchResult,
} from "../../../domain/user-badge.repository";
import { UserBadgeModelMapper } from "./user-badge-model-mapper";

export class UserBadgePrismaRepository implements IUserBadgeRepository {
  sortableFields: string[] = ["created_at", "progress"];

  constructor(private prismaClient: PrismaClient) {}

  async insert(entity: UserBadge): Promise<void> {
    const model = UserBadgeModelMapper.toModel(entity);
    try {
      await this.prismaClient.userBadge.create({
        data: model,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: UserBadge,
        id: entity.user_badge_id.id,
        operation: "userBadge.create",
      });
    }
  }

  async bulkInsert(entities: UserBadge[]): Promise<void> {
    const models = entities.map((entity) =>
      UserBadgeModelMapper.toModel(entity),
    );
    try {
      await this.prismaClient.userBadge.createMany({
        data: models,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: UserBadge,
        operation: "userBadge.createMany",
      });
    }
  }

  async update(entity: UserBadge): Promise<void> {
    const model = UserBadgeModelMapper.toModel(entity);
    try {
      await this.prismaClient.userBadge.update({
        where: { id: entity.user_badge_id.id },
        data: {
          audienceId: model.audienceId,
          badge_type: model.badge_type,
          progress: model.progress,
          is_unlocked: model.is_unlocked,
          unlocked_at: model.unlocked_at,
          updated_at: model.updated_at,
        },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: UserBadge,
        id: entity.user_badge_id.id,
        operation: "userBadge.update",
      });
    }
  }

  async delete(id: UserBadgeId): Promise<void> {
    try {
      await this.prismaClient.userBadge.delete({
        where: { id: id.id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: UserBadge,
        id: id.id,
        operation: "userBadge.delete",
      });
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
      orderBy: { created_at: "desc" },
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
        where.badge_type = props.filter.badge_type;
      }
      if (typeof props.filter.is_unlocked === "boolean") {
        where.is_unlocked = props.filter.is_unlocked;
      }
    }

    const orderBy: any = {};
    if (props.sort && this.sortableFields.includes(props.sort)) {
      orderBy[props.sort] = props.sort_dir || "desc";
    } else {
      orderBy.created_at = "desc";
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
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => UserBadgeModelMapper.toEntity(model));
  }

  async findByUserAndBadgeType(
    user_id: string,
    badge_type: string,
  ): Promise<UserBadge | null> {
    const model = await this.prismaClient.userBadge.findFirst({
      where: { audienceId: user_id, badge_type },
    });
    return model ? UserBadgeModelMapper.toEntity(model) : null;
  }

  async findUnlockedByUser(user_id: string): Promise<UserBadge[]> {
    const models = await this.prismaClient.userBadge.findMany({
      where: { audienceId: user_id, is_unlocked: true },
      orderBy: { unlocked_at: "desc" },
    });
    return models.map((model) => UserBadgeModelMapper.toEntity(model));
  }

  async findInProgressByUser(user_id: string): Promise<UserBadge[]> {
    const models = await this.prismaClient.userBadge.findMany({
      where: { audienceId: user_id, is_unlocked: false },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => UserBadgeModelMapper.toEntity(model));
  }
}
