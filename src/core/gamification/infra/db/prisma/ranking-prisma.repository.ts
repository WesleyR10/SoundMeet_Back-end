import { PrismaClient } from "@prisma/client";

import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Ranking, RankingId } from "../../../domain/ranking.aggregate";
import { IRankingRepository } from "../../../domain/ranking.repository";
import {
  RankingSearchParams,
  RankingSearchResult,
} from "../../../domain/ranking.repository";
import { RankingModelMapper } from "./ranking-model-mapper";

export class RankingPrismaRepository implements IRankingRepository {
  sortableFields: string[] = ["type", "period", "created_at"];

  constructor(private prismaClient: PrismaClient) {}

  async insert(entity: Ranking): Promise<void> {
    const model = RankingModelMapper.toModel(entity);
    await this.prismaClient.ranking.create({
      data: model,
    });
  }

  async bulkInsert(entities: Ranking[]): Promise<void> {
    const models = entities.map((entity) => RankingModelMapper.toModel(entity));
    await this.prismaClient.ranking.createMany({
      data: models,
    });
  }

  async update(entity: Ranking): Promise<void> {
    const model = RankingModelMapper.toModel(entity);
    try {
      await this.prismaClient.ranking.update({
        where: { id: entity.ranking_id.id },
        data: model,
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(entity.ranking_id.id, Ranking);
      }
      throw error;
    }
  }

  async delete(id: RankingId): Promise<void> {
    try {
      await this.prismaClient.ranking.delete({
        where: { id: id.id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(id.id, Ranking);
      }
      throw error;
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
        AND: [
          {
            data: {
              path: ["user_id"],
              equals: user_id,
            },
          },
          {
            data: {
              path: ["establishment_id"],
              equals: establishment_id,
            },
          },
        ],
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
        period: period,
        created_at: {
          gte: period_start,
          lte: period_end,
        },
        data: {
          path: ["user_id"],
          equals: user_id,
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
        data: {
          path: ["establishment_id"],
          equals: establishment_id,
        },
      },
      orderBy: { created_at: "desc" },
      take: limit || 10,
    });
    return models.map((model) => RankingModelMapper.toEntity(model));
  }

  async findCurrentRankings(
    establishment_id: string,
    period_type: string,
  ): Promise<Ranking[]> {
    const models = await this.prismaClient.ranking.findMany({
      where: {
        type: period_type,
        data: {
          path: ["establishment_id"],
          equals: establishment_id,
        },
      },
      orderBy: { created_at: "desc" },
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
      if (props.filter.user_id) {
        where.user_id = props.filter.user_id;
      }
      if (props.filter.ranking_type) {
        where.type = props.filter.ranking_type;
      }
      if (props.filter.period) {
        where.period = props.filter.period;
      }
      if (props.filter.position_max !== undefined) {
        where.data = {
          path: ["position"],
          lte: props.filter.position_max,
        };
      }
      if (props.filter.is_current_period !== undefined) {
        // Implementar lógica para período atual se necessário
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
        data: {
          path: ["user_id"],
          equals: user_id,
        },
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
