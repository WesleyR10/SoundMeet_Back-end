import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import {
  ITipRepository,
  TipFilter,
  TipSearchParams,
  TipSearchResult,
} from "../../../domain/repositories/tip.repository";
import { Tip } from "../../../domain/tip.entity";
import { TipModelMapper } from "./tip-model.mapper";

export class TipPrismaRepository implements ITipRepository {
  sortableFields: string[] = ["created_at", "amount", "status"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Tip): Promise<void> {
    const modelProps = TipModelMapper.toModel(entity);
    await this.prisma.tip.create({
      data: {
        ...modelProps,
        musicianId: modelProps.musicianId ?? null,
        bandId: modelProps.bandId ?? null,
        eventId: modelProps.eventId ?? null,
      },
    });
  }

  async bulkInsert(entities: Tip[]): Promise<void> {
    const modelsProps = entities.map((entity) => {
      const model = TipModelMapper.toModel(entity);
      return {
        ...model,
        musicianId: model.musicianId ?? null,
        bandId: model.bandId ?? null,
        eventId: model.eventId ?? null,
      };
    });
    await this.prisma.tip.createMany({
      data: modelsProps,
    });
  }

  async update(entity: Tip): Promise<void> {
    const modelProps = TipModelMapper.toModel(entity);
    try {
      await this.prisma.tip.update({
        where: { id: entity.tip_id.id },
        data: modelProps,
      });
    } catch (e) {
      throw new NotFoundError(entity.tip_id.id, Tip);
    }
  }

  async delete(entity_id: Uuid): Promise<void> {
    try {
      await this.prisma.tip.delete({
        where: { id: entity_id.id },
      });
    } catch (e) {
      throw new NotFoundError(entity_id.id, Tip);
    }
  }

  async findById(entity_id: Uuid | string): Promise<Tip | null> {
    const id = entity_id instanceof Uuid ? entity_id.id : entity_id;
    const model = await this.prisma.tip.findUnique({
      where: { id },
    });

    return model ? TipModelMapper.toEntity(model) : null;
  }

  async findAll(): Promise<Tip[]> {
    const models = await this.prisma.tip.findMany();
    return models.map((model) => TipModelMapper.toEntity(model));
  }

  async findByIds(ids: Uuid[]): Promise<Tip[]> {
    const models = await this.prisma.tip.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((m) => TipModelMapper.toEntity(m));
  }

  async existsById(
    ids: Uuid[],
  ): Promise<{ exists: Uuid[]; not_exists: Uuid[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.prisma.tip.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      select: { id: true },
    });

    const existingIds = existingModels.map((m) => m.id);
    const exists = ids.filter((id) => existingIds.includes(id.id));
    const not_exists = ids.filter((id) => !existingIds.includes(id.id));

    return {
      exists,
      not_exists,
    };
  }

  async search(props: TipSearchParams): Promise<TipSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const { where, orderBy } = this.buildSearchQuery(props);

    const [models, count] = await Promise.all([
      this.prisma.tip.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.tip.count({ where }),
    ]);

    const entities = models.map((model) => TipModelMapper.toEntity(model));

    return new TipSearchResult({
      items: entities,
      current_page: props.page,
      per_page: props.per_page,
      total: count,
    });
  }

  // Métodos específicos do domínio
  async findByMusicianId(musicianId: string): Promise<Tip[]> {
    const models = await this.prisma.tip.findMany({
      where: { musicianId },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => TipModelMapper.toEntity(model));
  }

  getEntity(): new (...args: any[]) => Tip {
    return Tip;
  }

  private buildSearchQuery(props: TipSearchParams) {
    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);
    return { where, orderBy };
  }

  private buildWhereClause(filter: TipFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.musician_id) {
      where.musicianId = filter.musician_id;
    }

    if (filter.audience_id) {
      where.audienceId = filter.audience_id;
    }

    if (filter.event_id) {
      where.eventId = filter.event_id;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    return where;
  }

  private buildOrderByClause(
    sort: string | null,
    sort_dir: "asc" | "desc" | null,
  ) {
    if (sort && this.sortableFields.includes(sort)) {
      return { [sort]: sort_dir || "asc" };
    }
    return { created_at: sort_dir || "asc" };
  }
}
