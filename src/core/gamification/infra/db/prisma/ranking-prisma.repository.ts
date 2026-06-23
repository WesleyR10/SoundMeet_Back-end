import { PrismaClient } from "@prisma/client";

import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { Ranking, RankingId } from "../../../domain/ranking.aggregate";
import {
  IRankingRepository,
  RankingFilter,
  RankingSearchParams,
  RankingSearchResult,
} from "../../../domain/ranking.repository";
import { RankingModelMapper } from "./ranking-model-mapper";

export class RankingPrismaRepository implements IRankingRepository {
  sortableFields: string[] = [
    "type",
    "period",
    "position",
    "score",
    "created_at",
  ];

  constructor(private prismaClient: PrismaClient) {}

  async insert(entity: Ranking): Promise<void> {
    const model = RankingModelMapper.toModel(entity);
    try {
      await this.prismaClient.ranking.create({
        data: model,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: Ranking,
        id: entity.ranking_id.id,
        operation: "ranking.create",
      });
    }
  }

  async bulkInsert(entities: Ranking[]): Promise<void> {
    const models = entities.map((entity) => RankingModelMapper.toModel(entity));
    try {
      await this.prismaClient.ranking.createMany({
        data: models,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: Ranking,
        operation: "ranking.createMany",
      });
    }
  }

  async update(entity: Ranking): Promise<void> {
    const model = RankingModelMapper.toModel(entity);
    try {
      await this.prismaClient.ranking.update({
        where: { id: entity.ranking_id.id },
        data: model,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: Ranking,
        id: entity.ranking_id.id,
        operation: "ranking.update",
      });
    }
  }

  async delete(id: RankingId): Promise<void> {
    try {
      await this.prismaClient.ranking.delete({
        where: { id: id.id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: Ranking,
        id: id.id,
        operation: "ranking.delete",
      });
    }
  }

  async findById(id: RankingId): Promise<Ranking | null> {
    const model = await this.prismaClient.ranking.findUnique({
      where: { id: id.id },
    });
    return model ? RankingModelMapper.toEntity(model) : null;
  }

  async findAll(): Promise<Ranking[]> {
    const models = await this.prismaClient.ranking.findMany();
    return models.map((model) => RankingModelMapper.toEntity(model));
  }

  async findByIds(ids: RankingId[]): Promise<Ranking[]> {
    const models = await this.prismaClient.ranking.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((model) => RankingModelMapper.toEntity(model));
  }

  getEntity(): new (...args: any[]) => Ranking {
    return Ranking;
  }

  // Métodos específicos da interface IRankingRepository
  async findByUserAndEstablishment(
    user_id: string,
    establishment_id: string,
    period_type: string,
  ): Promise<Ranking | null> {
    const model = await this.prismaClient.ranking.findFirst({
      where: {
        type: period_type,
        audienceId: user_id,
        establishmentId: establishment_id,
      },
      orderBy: { created_at: "desc" },
    });
    return model ? RankingModelMapper.toEntity(model) : null;
  }

  async findByUserAndTypeAndPeriod(
    user_id: string,
    ranking_type: string,
    period: string,
    period_start: Date,
    period_end: Date,
  ): Promise<Ranking | null> {
    const model = await this.prismaClient.ranking.findFirst({
      where: {
        type: ranking_type,
        period,
        audienceId: user_id,
        period_start: {
          gte: period_start,
        },
        period_end: {
          lte: period_end,
        },
      },
    });
    return model ? RankingModelMapper.toEntity(model) : null;
  }

  async findTopRankings(
    establishment_id: string,
    period_type: string,
    limit?: number,
  ): Promise<Ranking[]> {
    const models = await this.prismaClient.ranking.findMany({
      where: {
        type: period_type,
        establishmentId: establishment_id,
      },
      orderBy: { score: "desc" },
      take: limit || 10,
    });
    return models.map((model) => RankingModelMapper.toEntity(model));
  }

  async findCurrentRankings(
    ranking_type: string,
    period: string,
  ): Promise<Ranking[]> {
    const models = await this.prismaClient.ranking.findMany({
      where: {
        type: ranking_type,
        period,
      },
      orderBy: { position: "asc" },
    });
    return models.map((model) => RankingModelMapper.toEntity(model));
  }

  async existsById(
    ids: RankingId[],
  ): Promise<{ exists: RankingId[]; not_exists: RankingId[] }> {
    const existingModels = await this.prismaClient.ranking.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });

    const existingIds = existingModels.map((model) => model.id);
    const exists = ids.filter((id) => existingIds.includes(id.id));
    const not_exists = ids.filter((id) => !existingIds.includes(id.id));

    return { exists, not_exists };
  }

  async search(props: RankingSearchParams): Promise<RankingSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where: any = {};

    if (props.filter) {
      if (props.filter.ranking_type) {
        where.type = props.filter.ranking_type;
      }
      if (props.filter.period) {
        where.period = props.filter.period;
      }
      if (props.filter.user_id) {
        where.audienceId = props.filter.user_id;
      }
      if (props.filter.position_max) {
        where.position = {
          lte: props.filter.position_max,
        };
      }
      if (typeof props.filter.is_current_period === "boolean") {
        const now = new Date();
        if (props.filter.is_current_period) {
          where.AND = [
            {
              period_start: {
                lte: now,
              },
            },
            {
              period_end: {
                gte: now,
              },
            },
          ];
        } else {
          where.OR = [
            {
              period_end: {
                lt: now,
              },
            },
            {
              period_start: {
                gt: now,
              },
            },
          ];
        }
      }
    }

    const orderBy: any = {};
    if (props.sort && this.sortableFields.includes(props.sort)) {
      orderBy[props.sort] = props.sort_dir || "asc";
    } else {
      orderBy.created_at = "desc";
    }

    const [models, count] = await Promise.all([
      this.prismaClient.ranking.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prismaClient.ranking.count({ where }),
    ]);

    const items = models.map((model) => RankingModelMapper.toEntity(model));

    return new RankingSearchResult({
      items,
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  async findByType(type: string, limit: number = 10): Promise<Ranking[]> {
    const models = await this.prismaClient.ranking.findMany({
      where: { type },
      orderBy: { created_at: "desc" },
      take: limit,
    });
    return models.map((model) => RankingModelMapper.toEntity(model));
  }

  async findByUserAndType(
    user_id: string,
    type: string,
  ): Promise<Ranking | null> {
    const model = await this.prismaClient.ranking.findFirst({
      where: {
        type,
        audienceId: user_id,
      },
      orderBy: { created_at: "desc" },
    });
    return model ? RankingModelMapper.toEntity(model) : null;
  }

  async findByPeriod(period: string): Promise<Ranking[]> {
    const models = await this.prismaClient.ranking.findMany({
      where: { period },
      orderBy: [{ type: "asc" }, { created_at: "desc" }],
    });
    return models.map((model) => RankingModelMapper.toEntity(model));
  }

  async findTopByTypeAndPeriod(
    type: string,
    period: string,
    limit: number = 10,
  ): Promise<Ranking[]> {
    const models = await this.prismaClient.ranking.findMany({
      where: {
        type,
        period,
      },
      orderBy: { created_at: "desc" },
      take: limit,
    });
    return models.map((model) => RankingModelMapper.toEntity(model));
  }
}
