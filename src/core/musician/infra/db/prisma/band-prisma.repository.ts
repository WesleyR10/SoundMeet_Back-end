import { CurrencyEnum, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
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

  private isValidPrismaCurrency(currency: unknown): currency is CurrencyEnum {
    return (Object.values(CurrencyEnum) as unknown[]).includes(currency);
  }

  private toPrismaCurrency(currency: unknown): CurrencyEnum | null {
    if (!currency) {
      return null;
    }
    if (!this.isValidPrismaCurrency(currency)) {
      return null;
    }
    return currency;
  }

  async insert(entity: Band): Promise<void> {
    const modelProps = BandModelMapper.toModel(entity);
    try {
      await this.prisma.band.create({
        data: {
          ...modelProps,
          members: {
            create: entity.members.map((m) => ({
              id: m.member_id?.id ?? new Uuid().id,
              musicianId: m.musician_id.id,
              role: m.role,
              instrument: m.instrument,
              joinedAt: m.joined_at,
            })),
          },
        },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.band_id.id,
        operation: "band.create",
      });
    }
  }

  async bulkInsert(entities: Band[]): Promise<void> {
    for (const entity of entities) {
      await this.insert(entity);
    }
  }

  async update(entity: Band): Promise<void> {
    const id = entity.band_id.id;
    const modelProps = BandModelMapper.toModel(entity);

    try {
      await this.prisma.$transaction(async (tx) => {
        try {
          await tx.band.update({
            where: { id },
            data: modelProps,
          });
        } catch (error: any) {
          throw mapPrismaErrorToDomainError(error, {
            entityClass: this.getEntity(),
            id,
            operation: "band.update",
          });
        }

        await tx.bandMember.deleteMany({
          where: { bandId: id },
        });

        if (entity.members.length) {
          await tx.bandMember.createMany({
            data: entity.members.map((m) => ({
              id: m.member_id?.id ?? new Uuid().id,
              bandId: id,
              musicianId: m.musician_id.id,
              role: m.role,
              instrument: m.instrument,
              joinedAt: m.joined_at,
            })),
          });
        }
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "band.update.transaction",
      });
    }
  }

  async delete(id: BandId): Promise<void> {
    const bandId = id.id;

    try {
      await this.prisma.band.delete({
        where: { id: bandId },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "band.delete",
      });
    }
  }

  async findById(entity_id: BandId): Promise<Band | null> {
    const model = await this.prisma.band.findUnique({
      where: { id: entity_id.id },
      include: { members: { orderBy: { role: "asc" } } },
    });

    return model ? BandModelMapper.toEntity(model as any) : null;
  }

  async findByIds(ids: BandId[]): Promise<Band[]> {
    const models = await this.prisma.band.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      include: { members: { orderBy: { role: "asc" } } },
    });
    return models.map((m) => BandModelMapper.toEntity(m as any));
  }

  async findAll(): Promise<Band[]> {
    const models = await this.prisma.band.findMany({
      include: { members: { orderBy: { role: "asc" } } },
    });
    return models.map((model) => BandModelMapper.toEntity(model as any));
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
        include: { members: { orderBy: { role: "asc" } } },
      }),
      this.prisma.band.count({ where }),
    ]);

    const entities = bands.map((m) => BandModelMapper.toEntity(m as any));

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

    const prismaCurrency = this.toPrismaCurrency(filter.price_currency ?? null);

    if (filter.price_model) {
      where.price_model = filter.price_model;
    }

    if (prismaCurrency) {
      where.price_currency = prismaCurrency;
    }

    if (
      filter.price_min !== null &&
      filter.price_min !== undefined &&
      Number.isFinite(filter.price_min)
    ) {
      where.price_max = { gte: filter.price_min };
    }

    if (
      filter.price_max !== null &&
      filter.price_max !== undefined &&
      Number.isFinite(filter.price_max)
    ) {
      where.price_min = { lte: filter.price_max };
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
