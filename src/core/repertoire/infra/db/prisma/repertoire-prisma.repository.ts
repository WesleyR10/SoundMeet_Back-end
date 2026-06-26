import { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { Repertoire, RepertoireId } from "../../../domain/repertoire.aggregate";
import {
  IRepertoireRepository,
  RepertoireFilter,
  RepertoireSearchParams,
  RepertoireSearchResult,
} from "../../../domain/repertoire.repository";
import { RepertoireModelMapper } from "./repertoire-model-mapper";
import { RepertoireModel } from "./repertoire-model";

const INCLUDE_RELATIONS = {
  songs: { orderBy: { position: "asc" as const } },
  invitees: true,
};

export class RepertoirePrismaRepository implements IRepertoireRepository {
  sortableFields: string[] = ["name", "created_at"];

  constructor(private readonly prisma: PrismaClient) {}

  async insert(entity: Repertoire): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.repertoire.create({
          data: {
            ...RepertoireModelMapper.toModel(entity),
            songs: {
              create: entity.songs.map((s) =>
                RepertoireModelMapper.songToModel(s, entity.repertoire_id.id),
              ),
            },
            invitees: {
              create: entity.invitees.map((i) =>
                RepertoireModelMapper.inviteeToModel(i, entity.repertoire_id.id),
              ),
            },
          },
        });
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.repertoire_id.id,
        operation: "repertoire.insert",
      });
    }
  }

  async bulkInsert(entities: Repertoire[]): Promise<void> {
    for (const entity of entities) {
      await this.insert(entity);
    }
  }

  async update(entity: Repertoire): Promise<void> {
    const model = RepertoireModelMapper.toModel(entity);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.repertoire.update({
          where: { id: model.id },
          data: model,
        });

        await tx.repertoireSong.deleteMany({ where: { repertoire_id: model.id } });
        if (entity.songs.length > 0) {
          await tx.repertoireSong.createMany({
            data: entity.songs.map((s) =>
              RepertoireModelMapper.songToModel(s, model.id),
            ),
          });
        }

        await tx.repertoireInvitee.deleteMany({ where: { repertoire_id: model.id } });
        if (entity.invitees.length > 0) {
          await tx.repertoireInvitee.createMany({
            data: entity.invitees.map((i) =>
              RepertoireModelMapper.inviteeToModel(i, model.id),
            ),
          });
        }
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.repertoire_id.id,
        operation: "repertoire.update",
      });
    }
  }

  async delete(id: RepertoireId): Promise<void> {
    try {
      await this.prisma.repertoire.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "repertoire.delete",
      });
    }
  }

  async findById(id: RepertoireId): Promise<Repertoire | null> {
    const model = await this.prisma.repertoire.findUnique({
      where: { id: id.id },
      include: INCLUDE_RELATIONS,
    });
    return model ? RepertoireModelMapper.toEntity(model as RepertoireModel) : null;
  }

  async findAll(): Promise<Repertoire[]> {
    const models = await this.prisma.repertoire.findMany({
      include: INCLUDE_RELATIONS,
    });
    return models.map((m) => RepertoireModelMapper.toEntity(m as RepertoireModel));
  }

  async findByIds(ids: RepertoireId[]): Promise<Repertoire[]> {
    const models = await this.prisma.repertoire.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      include: INCLUDE_RELATIONS,
    });
    return models.map((m) => RepertoireModelMapper.toEntity(m as RepertoireModel));
  }

  async existsById(
    ids: RepertoireId[],
  ): Promise<{ exists: RepertoireId[]; not_exists: RepertoireId[] }> {
    const found = await this.prisma.repertoire.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });
    const foundSet = new Set(found.map((r) => r.id));
    return {
      exists: ids.filter((id) => foundSet.has(id.id)),
      not_exists: ids.filter((id) => !foundSet.has(id.id)),
    };
  }

  async findByMusicianId(musician_id: string): Promise<Repertoire[]> {
    const models = await this.prisma.repertoire.findMany({
      where: { musician_id },
      include: INCLUDE_RELATIONS,
      orderBy: { created_at: "desc" },
    });
    return models.map((m) => RepertoireModelMapper.toEntity(m as RepertoireModel));
  }

  async countByMusicianId(musician_id: string): Promise<number> {
    return this.prisma.repertoire.count({ where: { musician_id } });
  }

  async findByShareToken(token: string): Promise<Repertoire | null> {
    const model = await this.prisma.repertoire.findUnique({
      where: { share_token: token },
      include: INCLUDE_RELATIONS,
    });
    return model ? RepertoireModelMapper.toEntity(model as RepertoireModel) : null;
  }

  async findSharedWithMusician(musician_id: string): Promise<Repertoire[]> {
    const models = await this.prisma.repertoire.findMany({
      where: { invitees: { some: { musician_id } } },
      include: INCLUDE_RELATIONS,
      orderBy: { created_at: "desc" },
    });
    return models.map((m) => RepertoireModelMapper.toEntity(m as RepertoireModel));
  }

  async search(params: RepertoireSearchParams): Promise<RepertoireSearchResult> {
    const offset = (params.page - 1) * params.per_page;
    const where: any = {};

    if (params.filter?.musician_id) {
      where.musician_id = params.filter.musician_id;
    }
    if (params.filter?.name) {
      where.name = { contains: params.filter.name, mode: "insensitive" };
    }

    const sortField =
      params.sort && this.sortableFields.includes(params.sort)
        ? params.sort
        : "created_at";
    const sortDir = params.sort_dir ?? "desc";

    const [total, models] = await this.prisma.$transaction([
      this.prisma.repertoire.count({ where }),
      this.prisma.repertoire.findMany({
        where,
        include: INCLUDE_RELATIONS,
        skip: offset,
        take: params.per_page,
        orderBy: { [sortField]: sortDir },
      }),
    ]);

    return new RepertoireSearchResult({
      items: models.map((m) => RepertoireModelMapper.toEntity(m as RepertoireModel)),
      total,
      current_page: params.page,
      per_page: params.per_page,
    });
  }

  getEntity(): new (...args: any[]) => Repertoire {
    return Repertoire;
  }
}
