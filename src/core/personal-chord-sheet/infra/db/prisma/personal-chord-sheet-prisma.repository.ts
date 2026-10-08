import { PrismaClient } from "@prisma/client";

import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  PersonalChordSheet,
  PersonalChordSheetId,
  type PersonalChordSheetShareScope,
} from "../../../domain/personal-chord-sheet.aggregate";
import {
  IPersonalChordSheetRepository,
  PersonalChordSheetSearchParams,
  PersonalChordSheetSearchResult,
} from "../../../domain/personal-chord-sheet.repository";
import { PersonalChordSheetModel } from "./personal-chord-sheet-model";
import { PersonalChordSheetModelMapper } from "./personal-chord-sheet-model-mapper";

export class PersonalChordSheetPrismaRepository implements IPersonalChordSheetRepository {
  sortableFields: string[] = ["created_at", "updated_at", "shared_at"];

  constructor(private readonly prisma: PrismaClient) {}

  async insert(entity: PersonalChordSheet): Promise<void> {
    try {
      await this.prisma.personalChordSheet.create({
        data: PersonalChordSheetModelMapper.toModel(entity) as never,
      });
    } catch (error: any) {
      // P2002 no índice único (musician_id, music_library_id) vira ConflictError:
      // é a corrida de dois POSTs simultâneos criando o mesmo fork.
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.personal_chord_sheet_id.id,
        operation: "personalChordSheet.insert",
      });
    }
  }

  async bulkInsert(entities: PersonalChordSheet[]): Promise<void> {
    for (const entity of entities) {
      await this.insert(entity);
    }
  }

  async update(entity: PersonalChordSheet): Promise<void> {
    const model = PersonalChordSheetModelMapper.toModel(entity);
    try {
      await this.prisma.personalChordSheet.update({
        where: { id: model.id },
        data: model as never,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.personal_chord_sheet_id.id,
        operation: "personalChordSheet.update",
      });
    }
  }

  async delete(id: PersonalChordSheetId): Promise<void> {
    try {
      await this.prisma.personalChordSheet.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "personalChordSheet.delete",
      });
    }
  }

  async findById(id: PersonalChordSheetId): Promise<PersonalChordSheet | null> {
    const model = await this.prisma.personalChordSheet.findUnique({
      where: { id: id.id },
    });
    return model ? this.toEntity(model) : null;
  }

  async findAll(): Promise<PersonalChordSheet[]> {
    const models = await this.prisma.personalChordSheet.findMany({
      orderBy: { updated_at: "desc" },
    });
    return models.map((m) => this.toEntity(m));
  }

  async findByIds(ids: PersonalChordSheetId[]): Promise<PersonalChordSheet[]> {
    const models = await this.prisma.personalChordSheet.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((m) => this.toEntity(m));
  }

  async existsById(ids: PersonalChordSheetId[]): Promise<{
    exists: PersonalChordSheetId[];
    not_exists: PersonalChordSheetId[];
  }> {
    const models = await this.prisma.personalChordSheet.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });
    const found = new Set(models.map((m) => m.id));
    return {
      exists: ids.filter((id) => found.has(id.id)),
      not_exists: ids.filter((id) => !found.has(id.id)),
    };
  }

  // ─── Consultas do domínio ──────────────────────────────────────────────────

  async findByMusicianAndMusicLibrary(
    musician_id: string,
    music_library_id: string,
  ): Promise<PersonalChordSheet | null> {
    const model = await this.prisma.personalChordSheet.findUnique({
      where: {
        musician_id_music_library_id: { musician_id, music_library_id },
      },
    });
    return model ? this.toEntity(model) : null;
  }

  async findByMusicianId(musician_id: string): Promise<PersonalChordSheet[]> {
    const models = await this.prisma.personalChordSheet.findMany({
      where: { musician_id },
      orderBy: { updated_at: "desc" },
    });
    return models.map((m) => this.toEntity(m));
  }

  async countByMusicianId(musician_id: string): Promise<number> {
    return this.prisma.personalChordSheet.count({ where: { musician_id } });
  }

  async findSharedByMusicLibraryId(
    music_library_id: string,
    scope?: Exclude<PersonalChordSheetShareScope, "private">,
  ): Promise<PersonalChordSheet[]> {
    const models = await this.prisma.personalChordSheet.findMany({
      where: {
        music_library_id,
        share_scope: scope ?? { not: "private" },
      },
      orderBy: { shared_at: "desc" },
    });
    return models.map((m) => this.toEntity(m));
  }

  async search(
    params: PersonalChordSheetSearchParams,
  ): Promise<PersonalChordSheetSearchResult> {
    const offset = (params.page - 1) * params.per_page;
    const where: any = {};

    if (params.filter?.musician_id) {
      where.musician_id = params.filter.musician_id;
    }
    if (params.filter?.music_library_id) {
      where.music_library_id = params.filter.music_library_id;
    }
    if (params.filter?.share_scope) {
      where.share_scope = params.filter.share_scope;
    }
    if (params.filter?.reconcile_status) {
      where.reconcile_status = params.filter.reconcile_status;
    }

    const sortField =
      params.sort && this.sortableFields.includes(params.sort)
        ? params.sort
        : "updated_at";
    const sortDir = params.sort_dir ?? "desc";

    const [total, models] = await this.prisma.$transaction([
      this.prisma.personalChordSheet.count({ where }),
      this.prisma.personalChordSheet.findMany({
        where,
        skip: offset,
        take: params.per_page,
        orderBy: { [sortField]: sortDir },
      }),
    ]);

    return new PersonalChordSheetSearchResult({
      items: models.map((m) => this.toEntity(m)),
      total,
      current_page: params.page,
      per_page: params.per_page,
    });
  }

  getEntity(): new (...args: any[]) => PersonalChordSheet {
    return PersonalChordSheet;
  }

  private toEntity(model: unknown): PersonalChordSheet {
    return PersonalChordSheetModelMapper.toEntity(
      model as PersonalChordSheetModel,
    );
  }
}
