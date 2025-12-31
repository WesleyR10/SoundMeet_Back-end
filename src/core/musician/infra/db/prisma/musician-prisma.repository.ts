import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import {
  IMusicianRepository,
  MusicianFilter,
  MusicianSearchParams,
  MusicianSearchResult,
} from "../../../domain/musician.repository";
import { MusicianModelMapper } from "./musician-model-mapper";

export class MusicianPrismaRepository implements IMusicianRepository {
  sortableFields: string[] = ["name", "stage_name", "created_at", "rating"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Musician): Promise<void> {
    const modelProps = MusicianModelMapper.toModel(entity);
    await this.prisma.musician.create({
      data: modelProps,
    });
  }

  async bulkInsert(entities: Musician[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      MusicianModelMapper.toModel(entity),
    );
    await this.prisma.musician.createMany({
      data: modelsProps,
    });
  }

  async update(entity: Musician): Promise<void> {
    const id = entity.id.id;
    const modelProps = MusicianModelMapper.toModel(entity);

    try {
      await this.prisma.musician.update({
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

  async delete(id: MusicianId): Promise<void> {
    const musicianId = id.id;

    try {
      await this.prisma.musician.delete({
        where: { id: musicianId },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(id.id, this.getEntity());
      }
      throw error;
    }
  }

  async findById(entity_id: MusicianId): Promise<Musician | null> {
    const model = await this.prisma.musician.findUnique({
      where: { id: entity_id.id },
    });

    return model ? MusicianModelMapper.toEntity(model) : null;
  }

  async findByIds(ids: MusicianId[]): Promise<Musician[]> {
    const models = await this.prisma.musician.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((m) => MusicianModelMapper.toEntity(m));
  }

  async findAll(): Promise<Musician[]> {
    const models = await this.prisma.musician.findMany();
    return models.map((model) => MusicianModelMapper.toEntity(model));
  }

  async existsById(
    ids: MusicianId[],
  ): Promise<{ exists: MusicianId[]; not_exists: MusicianId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.prisma.musician.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      select: { id: true },
    });

    const existingIds = existingModels.map((m) => new MusicianId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existingId) => existingId.equals(id)),
    );

    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  async search(props: MusicianSearchParams): Promise<MusicianSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [musicians, total] = await Promise.all([
      this.prisma.musician.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.musician.count({ where }),
    ]);

    const entities = musicians.map((m) => MusicianModelMapper.toEntity(m));

    return new MusicianSearchResult({
      items: entities,
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private buildWhereClause(filter?: MusicianFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.name) {
      where.name = {
        contains: filter.name,
        mode: "insensitive",
      };
    }

    if (filter.stage_name) {
      where.stage_name = {
        contains: filter.stage_name,
        mode: "insensitive",
      };
    }

    if (filter.email) {
      where.email = {
        contains: filter.email,
        mode: "insensitive",
      };
    }

    if (filter.genres && filter.genres.length > 0) {
      where.genres = {
        hasSome: filter.genres,
      };
    }

    if (filter.instruments && filter.instruments.length > 0) {
      where.instruments = {
        hasSome: filter.instruments,
      };
    }

    if (filter.is_active !== undefined) {
      where.is_active = filter.is_active;
    }

    if (filter.is_verified !== undefined) {
      where.is_verified = filter.is_verified;
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

  getEntity(): new (...args: any[]) => Musician {
    return Musician;
  }
}
