import { PrismaClient } from "@prisma/client";

import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  UserPoints,
  UserPointsId,
} from "../../../domain/user-points.aggregate";
import { IUserPointsRepository } from "../../../domain/user-points.repository";
import {
  UserPointsSearchParams,
  UserPointsSearchResult,
} from "../../../domain/user-points.repository";
import { UserPointsModelMapper } from "./user-points-model-mapper";

export class UserPointsPrismaRepository implements IUserPointsRepository {
  sortableFields: string[] = ["points", "created_at"];

  constructor(private prismaClient: PrismaClient) {}

  async insert(entity: UserPoints): Promise<void> {
    const model = UserPointsModelMapper.toModel(entity);
    try {
      await this.prismaClient.userPoints.create({
        data: model,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: UserPoints,
        id: entity.user_points_id.id,
        operation: "userPoints.create",
      });
    }
  }

  async bulkInsert(entities: UserPoints[]): Promise<void> {
    const models = entities.map((entity) =>
      UserPointsModelMapper.toModel(entity),
    );
    try {
      await this.prismaClient.userPoints.createMany({
        data: models,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: UserPoints,
        operation: "userPoints.createMany",
      });
    }
  }

  async update(entity: UserPoints): Promise<void> {
    const model = UserPointsModelMapper.toModel(entity);
    try {
      await this.prismaClient.userPoints.update({
        where: { id: entity.user_points_id.id },
        data: model,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: UserPoints,
        id: entity.user_points_id.id,
        operation: "userPoints.update",
      });
    }
  }

  async delete(id: UserPointsId): Promise<void> {
    try {
      await this.prismaClient.userPoints.delete({
        where: { id: id.id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: UserPoints,
        id: id.id,
        operation: "userPoints.delete",
      });
    }
  }

  async findById(id: UserPointsId): Promise<UserPoints | null> {
    const model = await this.prismaClient.userPoints.findUnique({
      where: { id: id.id },
    });
    return model ? UserPointsModelMapper.toEntity(model) : null;
  }

  async findByIds(ids: UserPointsId[]): Promise<UserPoints[]> {
    const models = await this.prismaClient.userPoints.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((model) => UserPointsModelMapper.toEntity(model));
  }

  async existsById(
    ids: UserPointsId[],
  ): Promise<{ exists: UserPointsId[]; not_exists: UserPointsId[] }> {
    const existingModels = await this.prismaClient.userPoints.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });

    const existingIds = existingModels.map((model) => model.id);
    const exists = ids.filter((id) => existingIds.includes(id.id));
    const not_exists = ids.filter((id) => !existingIds.includes(id.id));

    return { exists, not_exists };
  }

  async search(props: UserPointsSearchParams): Promise<UserPointsSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where: any = {};

    if (props.filter) {
      if (props.filter.audienceId) {
        where.audienceId = props.filter.audienceId;
      }
      if (props.filter.points_gte !== undefined) {
        where.points = {
          ...where.points,
          gte: props.filter.points_gte,
        };
      }
      if (props.filter.points_lte !== undefined) {
        where.points = {
          ...where.points,
          lte: props.filter.points_lte,
        };
      }
      if (props.filter.source) {
        where.source = {
          contains: props.filter.source,
          mode: "insensitive",
        };
      }
    }

    const orderBy: any = {};
    if (props.sort && this.sortableFields.includes(props.sort)) {
      orderBy[props.sort] = props.sort_dir || "desc";
    } else {
      orderBy.points = "desc";
    }

    const [models, count] = await Promise.all([
      this.prismaClient.userPoints.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prismaClient.userPoints.count({ where }),
    ]);

    return new UserPointsSearchResult({
      items: models.map((model) => UserPointsModelMapper.toEntity(model)),
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  async findByUserId(user_id: string): Promise<UserPoints | null> {
    const model = await this.prismaClient.userPoints.findFirst({
      where: { audienceId: user_id },
    });
    return model ? UserPointsModelMapper.toEntity(model) : null;
  }

  async findTopUsers(limit: number = 10): Promise<UserPoints[]> {
    const models = await this.prismaClient.userPoints.findMany({
      orderBy: { points: "desc" },
      take: limit,
    });
    return models.map((model) => UserPointsModelMapper.toEntity(model));
  }

  async findByLevel(level: number): Promise<UserPoints[]> {
    // Como o schema não tem current_level, vamos buscar por pontos
    // Assumindo que cada nível tem uma faixa de pontos
    const minPoints = level * 100; // Exemplo: nível 1 = 100 pontos
    const maxPoints = (level + 1) * 100 - 1;

    const models = await this.prismaClient.userPoints.findMany({
      where: {
        points: {
          gte: minPoints,
          lte: maxPoints,
        },
      },
    });
    return models.map((model) => UserPointsModelMapper.toEntity(model));
  }

  async findAll(): Promise<UserPoints[]> {
    const models = await this.prismaClient.userPoints.findMany();
    return models.map((model) => UserPointsModelMapper.toEntity(model));
  }

  getEntity(): new (...args: any[]) => UserPoints {
    return UserPoints;
  }
}
