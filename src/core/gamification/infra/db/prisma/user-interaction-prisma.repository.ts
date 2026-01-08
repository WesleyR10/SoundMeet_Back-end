import { UserInteractionId } from "@core/gamification/domain/value-objects/gamification-id.vo";
import { PrismaClient } from "@prisma/client";

import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { UserInteraction } from "../../../domain/user-interaction.aggregate";
import { IUserInteractionRepository } from "../../../domain/user-interaction.repository";
import {
  UserInteractionSearchParams,
  UserInteractionSearchResult,
} from "../../../domain/user-interaction.repository";
import { UserInteractionModelMapper } from "./user-interaction-model-mapper";

export class UserInteractionPrismaRepository implements IUserInteractionRepository {
  sortableFields: string[] = ["points", "created_at"];

  constructor(private prismaClient: PrismaClient) {}

  async insert(entity: UserInteraction): Promise<void> {
    const model = UserInteractionModelMapper.toModel(entity);
    await this.prismaClient.userInteraction.create({
      data: model,
    });
  }

  async bulkInsert(entities: UserInteraction[]): Promise<void> {
    const models = entities.map((entity) =>
      UserInteractionModelMapper.toModel(entity),
    );
    await this.prismaClient.userInteraction.createMany({
      data: models,
    });
  }

  async update(entity: UserInteraction): Promise<void> {
    const model = UserInteractionModelMapper.toModel(entity);
    try {
      await this.prismaClient.userInteraction.update({
        where: { id: entity.user_interaction_id.id },
        data: model,
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(entity.user_interaction_id.id, UserInteraction);
      }
      throw error;
    }
  }

  async delete(id: UserInteractionId): Promise<void> {
    try {
      await this.prismaClient.userInteraction.delete({
        where: { id: id.id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(id.id, UserInteraction);
      }
      throw error;
    }
  }

  async findById(id: UserInteractionId): Promise<UserInteraction | null> {
    const model = await this.prismaClient.userInteraction.findUnique({
      where: { id: id.id },
    });

    return model ? UserInteractionModelMapper.toEntity(model) : null;
  }

  async findAll(): Promise<UserInteraction[]> {
    const models = await this.prismaClient.userInteraction.findMany();
    return models.map((model) => UserInteractionModelMapper.toEntity(model));
  }

  async findByIds(ids: UserInteractionId[]): Promise<UserInteraction[]> {
    const models = await this.prismaClient.userInteraction.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });

    return models.map((model) => UserInteractionModelMapper.toEntity(model));
  }

  async existsById(
    ids: UserInteractionId[],
  ): Promise<{ exists: UserInteractionId[]; not_exists: UserInteractionId[] }> {
    const existingModels = await this.prismaClient.userInteraction.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });

    const existingIds = existingModels.map((model) => model.id);
    const exists = ids.filter((id) => existingIds.includes(id.id));
    const not_exists = ids.filter((id) => !existingIds.includes(id.id));

    return { exists, not_exists };
  }

  getEntity(): new (...args: any[]) => UserInteraction {
    return UserInteraction;
  }

  async search(
    props: UserInteractionSearchParams,
  ): Promise<UserInteractionSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where: any = {};

    if (props.filter?.user_id) {
      where.audienceId = props.filter.user_id;
    }

    if (props.filter?.interaction_type) {
      where.type = props.filter.interaction_type;
    }

    if (props.filter?.target_id) {
      where.musicianId = props.filter.target_id;
    }

    if (props.filter?.points_earned !== undefined) {
      where.points = props.filter.points_earned;
    }

    const [models, count] = await Promise.all([
      this.prismaClient.userInteraction.findMany({
        where,
        orderBy: props.sort ? { [props.sort]: props.sort_dir } : undefined,
        skip: offset,
        take: limit,
      }),
      this.prismaClient.userInteraction.count({ where }),
    ]);

    const items = models.map((model) =>
      UserInteractionModelMapper.toEntity(model),
    );

    return new UserInteractionSearchResult({
      items,
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  async findByUserId(userId: string): Promise<UserInteraction[]> {
    const models = await this.prismaClient.userInteraction.findMany({
      where: { audienceId: userId },
    });

    return models.map((model) => UserInteractionModelMapper.toEntity(model));
  }

  async findByInteractionType(
    interactionType: string,
  ): Promise<UserInteraction[]> {
    const models = await this.prismaClient.userInteraction.findMany({
      where: { type: interactionType },
    });

    return models.map((model) => UserInteractionModelMapper.toEntity(model));
  }

  async findByUserIdAndType(
    userId: string,
    interactionType: string,
  ): Promise<UserInteraction[]> {
    const models = await this.prismaClient.userInteraction.findMany({
      where: {
        audienceId: userId,
        type: interactionType,
      },
    });

    return models.map((model) => UserInteractionModelMapper.toEntity(model));
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<UserInteraction[]> {
    const models = await this.prismaClient.userInteraction.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return models.map((model) => UserInteractionModelMapper.toEntity(model));
  }

  async getTotalPointsByUserId(userId: string): Promise<number> {
    const result = await this.prismaClient.userInteraction.aggregate({
      where: { audienceId: userId },
      _sum: {
        points: true,
      },
    });

    return result._sum.points || 0;
  }

  async getInteractionCountByType(interactionType: string): Promise<number> {
    return this.prismaClient.userInteraction.count({
      where: {
        type: interactionType,
      },
    });
  }
}
