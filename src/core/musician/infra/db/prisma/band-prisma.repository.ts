import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import {
  BandFilter,
  BandSearchParams,
  BandSearchResult,
  IBandRepository,
} from "../../../domain/band.repository";
import { BandModelMapper } from "./band-model-mapper";

export class BandPrismaRepository implements IBandRepository {
  sortableFields: string[] = ["name", "created_at"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Band): Promise<void> {
    const modelProps = BandModelMapper.toModel(entity);
    await this.prisma.band.create({
      data: modelProps,
    });
  }

  async bulkInsert(entities: Band[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      BandModelMapper.toModel(entity),
    );
    await this.prisma.band.createMany({
      data: modelsProps,
    });
  }

  async update(entity: Band): Promise<void> {
    const id = entity.band_id.id;
    const modelProps = BandModelMapper.toModel(entity);

    try {
      await this.prisma.band.update({
        where: { id: id },
        data: modelProps,
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(id, this.getEntity());
      }
      throw error;
    }
  }

  async delete(id: BandId): Promise<void> {
    const bandId = id.id;

    try {
      await this.prisma.band.delete({
        where: { id: bandId },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(id.id, this.getEntity());
      }
      throw error;
    }
  }

  async findById(entity_id: BandId): Promise<Band | null> {
    const model = await this.prisma.band.findUnique({
      where: { id: entity_id.id },
    });

    return model
      ? BandModelMapper.toEntity({
          ...model,
          members: [],
        } as any)
      : null;
  }

  async findByIds(ids: BandId[]): Promise<Band[]> {
    const models = await this.prisma.band.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((m) =>
      BandModelMapper.toEntity({
        ...m,
        members: [],
      } as any),
    );
  }

  async findAll(): Promise<Band[]> {
    const models = await this.prisma.band.findMany();
    return models.map((model) =>
      BandModelMapper.toEntity({
        ...model,
        members: [],
      } as any),
    );
  }

  async existsById(
    ids: BandId[],
  ): Promise<{ exists: BandId[]; not_exists: BandId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.prisma.band.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      select: { id: true },
    });

    const existingIds = existingModels.map((m) => new BandId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existingId) => existingId.equals(id)),
    );

    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  async search(props: BandSearchParams): Promise<BandSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [bands, total] = await Promise.all([
      this.prisma.band.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.band.count({ where }),
    ]);

    const entities = bands.map((m) =>
      BandModelMapper.toEntity({
        ...m,
        members: [],
      } as any),
    );

    return new BandSearchResult({
      items: entities,
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private buildWhereClause(filter?: BandFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.name) {
      where.name = {
        contains: filter.name,
        mode: "insensitive",
      };
    }

    if (filter.genres && filter.genres.length > 0) {
      where.genres = {
        hasSome: filter.genres,
      };
    }

    if (filter.is_active !== undefined) {
      where.is_active = filter.is_active;
    }

    return where;
  }

  private buildOrderByClause(sort?: string | null, sort_dir?: string | null) {
    if (!sort || !this.sortableFields.includes(sort)) {
      return { created_at: "desc" as const };
    }

    return {
      [sort]: sort_dir === "asc" ? ("asc" as const) : ("desc" as const),
    };
  }

  getEntity(): new (...args: any[]) => Band {
    return Band;
  }
}
