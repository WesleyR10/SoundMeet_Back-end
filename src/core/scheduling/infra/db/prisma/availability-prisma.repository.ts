import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  Availability,
  AvailabilityId,
} from "../../../domain/availability.aggregate";
import {
  AvailabilityFilter,
  AvailabilitySearchParams,
  AvailabilitySearchResult,
  IAvailabilityRepository,
} from "../../../domain/availability.repository";
import { AvailabilityModelMapper } from "./availability-model-mapper";

type CalendarSettingsModel = {
  id: string;
  musicianId?: string | null;
  bandId?: string | null;
  timezone: string;
  default_buffer_minutes: number;
  max_shows_per_day: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export class AvailabilityPrismaRepository implements IAvailabilityRepository {
  sortableFields: string[] = ["created_at", "updated_at", "is_active"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Availability): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (entity.musician_id) {
          await tx.musicianCalendarSettings.create({
            data: {
              id: entity.availability_id.id,
              musicianId: entity.musician_id.id,
              timezone: entity.timezone,
              default_buffer_minutes: entity.default_buffer_minutes,
              max_shows_per_day: entity.max_shows_per_day,
              is_active: entity.is_active,
            },
          });

          if (entity.weekly_rules.length) {
            await tx.musicianAvailabilityRule.createMany({
              data: entity.weekly_rules.map((r) => ({
                id: r.id.id,
                musicianId: entity.musician_id!.id,
                weekday: r.weekday,
                start_time: r.start_time,
                end_time: r.end_time,
                is_available: r.is_available,
                created_at: r.created_at,
              })),
            });
          }

          if (entity.unavailabilities.length) {
            await tx.musicianUnavailability.createMany({
              data: entity.unavailabilities.map((u) => ({
                id: u.id.id,
                musicianId: entity.musician_id!.id,
                start_at: u.start_at,
                end_at: u.end_at,
                reason: u.reason,
                created_at: u.created_at,
              })),
            });
          }
          return;
        }

        if (entity.band_id) {
          await tx.bandCalendarSettings.create({
            data: {
              id: entity.availability_id.id,
              bandId: entity.band_id.id,
              timezone: entity.timezone,
              default_buffer_minutes: entity.default_buffer_minutes,
              max_shows_per_day: entity.max_shows_per_day,
              is_active: entity.is_active,
            },
          });

          if (entity.weekly_rules.length) {
            await tx.bandAvailabilityRule.createMany({
              data: entity.weekly_rules.map((r) => ({
                id: r.id.id,
                bandId: entity.band_id!.id,
                weekday: r.weekday,
                start_time: r.start_time,
                end_time: r.end_time,
                is_available: r.is_available,
                created_at: r.created_at,
              })),
            });
          }

          if (entity.unavailabilities.length) {
            await tx.bandUnavailability.createMany({
              data: entity.unavailabilities.map((u) => ({
                id: u.id.id,
                bandId: entity.band_id!.id,
                start_at: u.start_at,
                end_at: u.end_at,
                reason: u.reason,
                created_at: u.created_at,
              })),
            });
          }
        }
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.availability_id.id,
        operation: "availability.create.transaction",
      });
    }
  }

  async bulkInsert(entities: Availability[]): Promise<void> {
    for (const entity of entities) {
      await this.insert(entity);
    }
  }

  async update(entity: Availability): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (entity.musician_id) {
          try {
            await tx.musicianCalendarSettings.update({
              where: { id: entity.availability_id.id },
              data: {
                timezone: entity.timezone,
                default_buffer_minutes: entity.default_buffer_minutes,
                max_shows_per_day: entity.max_shows_per_day,
                is_active: entity.is_active,
                updated_at: entity.updated_at,
              },
            });
          } catch (error: any) {
            throw mapPrismaErrorToDomainError(error, {
              entityClass: this.getEntity(),
              id: entity.availability_id.id,
              operation: "musicianCalendarSettings.update",
            });
          }

          await tx.musicianUnavailability.deleteMany({
            where: { musicianId: entity.musician_id.id },
          });

          await tx.musicianAvailabilityRule.deleteMany({
            where: { musicianId: entity.musician_id.id },
          });

          if (entity.weekly_rules.length) {
            await tx.musicianAvailabilityRule.createMany({
              data: entity.weekly_rules.map((r) => ({
                id: r.id.id,
                musicianId: entity.musician_id!.id,
                weekday: r.weekday,
                start_time: r.start_time,
                end_time: r.end_time,
                is_available: r.is_available,
                created_at: r.created_at,
              })),
            });
          }

          if (entity.unavailabilities.length) {
            await tx.musicianUnavailability.createMany({
              data: entity.unavailabilities.map((u) => ({
                id: u.id.id,
                musicianId: entity.musician_id!.id,
                start_at: u.start_at,
                end_at: u.end_at,
                reason: u.reason,
                created_at: u.created_at,
              })),
            });
          }
          return;
        }

        if (entity.band_id) {
          try {
            await tx.bandCalendarSettings.update({
              where: { id: entity.availability_id.id },
              data: {
                timezone: entity.timezone,
                default_buffer_minutes: entity.default_buffer_minutes,
                max_shows_per_day: entity.max_shows_per_day,
                is_active: entity.is_active,
                updated_at: entity.updated_at,
              },
            });
          } catch (error: any) {
            throw mapPrismaErrorToDomainError(error, {
              entityClass: this.getEntity(),
              id: entity.availability_id.id,
              operation: "bandCalendarSettings.update",
            });
          }

          await tx.bandUnavailability.deleteMany({
            where: { bandId: entity.band_id.id },
          });

          await tx.bandAvailabilityRule.deleteMany({
            where: { bandId: entity.band_id.id },
          });

          if (entity.weekly_rules.length) {
            await tx.bandAvailabilityRule.createMany({
              data: entity.weekly_rules.map((r) => ({
                id: r.id.id,
                bandId: entity.band_id!.id,
                weekday: r.weekday,
                start_time: r.start_time,
                end_time: r.end_time,
                is_available: r.is_available,
                created_at: r.created_at,
              })),
            });
          }

          if (entity.unavailabilities.length) {
            await tx.bandUnavailability.createMany({
              data: entity.unavailabilities.map((u) => ({
                id: u.id.id,
                bandId: entity.band_id!.id,
                start_at: u.start_at,
                end_at: u.end_at,
                reason: u.reason,
                created_at: u.created_at,
              })),
            });
          }
        }
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.availability_id.id,
        operation: "availability.update.transaction",
      });
    }
  }

  async delete(entity_id: AvailabilityId): Promise<void> {
    const target = await this.findTargetById(entity_id);
    if (!target) {
      throw new NotFoundError(entity_id.id, this.getEntity());
    }

    await this.prisma.$transaction(async (tx) => {
      if ((target as any).musicianId) {
        await tx.musicianUnavailability.deleteMany({
          where: { musicianId: (target as any).musicianId },
        });
        await tx.musicianAvailabilityRule.deleteMany({
          where: { musicianId: (target as any).musicianId },
        });
        await tx.musicianCalendarSettings.delete({
          where: { id: entity_id.id },
        });
        return;
      }

      if ((target as any).bandId) {
        await tx.bandAvailabilityRule.deleteMany({
          where: { bandId: (target as any).bandId },
        });
        await tx.bandUnavailability.deleteMany({
          where: { bandId: (target as any).bandId },
        });
        await tx.bandCalendarSettings.delete({
          where: { id: entity_id.id },
        });
      }
    });
  }

  async findById(entity_id: AvailabilityId): Promise<Availability | null> {
    const target = await this.findTargetById(entity_id);
    if (!target) return null;
    return this.mapToEntity(target);
  }

  async findByMusicianId(musician_id: string): Promise<Availability | null> {
    const settings = await this.prisma.musicianCalendarSettings.findUnique({
      where: { musicianId: musician_id },
    });
    if (!settings) return null;
    return this.mapToEntity(settings as any);
  }

  async findByBandId(band_id: string): Promise<Availability | null> {
    const settings = await this.prisma.bandCalendarSettings.findUnique({
      where: { bandId: band_id },
    });
    if (!settings) return null;
    return this.mapToEntity(settings as any);
  }

  async findAll(): Promise<Availability[]> {
    const [musicians, bands] = await Promise.all([
      this.prisma.musicianCalendarSettings.findMany(),
      this.prisma.bandCalendarSettings.findMany(),
    ]);
    const settings = [...musicians, ...bands] as any[];
    const items = await Promise.all(settings.map((s) => this.mapToEntity(s)));
    return items;
  }

  async findByIds(ids: AvailabilityId[]): Promise<Availability[]> {
    const idList = ids.map((id) => id.id);
    const [musicians, bands] = await Promise.all([
      this.prisma.musicianCalendarSettings.findMany({
        where: { id: { in: idList } },
      }),
      this.prisma.bandCalendarSettings.findMany({
        where: { id: { in: idList } },
      }),
    ]);
    const settings = [...musicians, ...bands] as any[];
    const items = await Promise.all(settings.map((s) => this.mapToEntity(s)));
    return items;
  }

  async existsById(
    ids: AvailabilityId[],
  ): Promise<{ exists: AvailabilityId[]; not_exists: AvailabilityId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const idList = ids.map((id) => id.id);
    const [musicians, bands] = await Promise.all([
      this.prisma.musicianCalendarSettings.findMany({
        where: { id: { in: idList } },
        select: { id: true },
      }),
      this.prisma.bandCalendarSettings.findMany({
        where: { id: { in: idList } },
        select: { id: true },
      }),
    ]);

    const existingIds = [...musicians, ...bands].map(
      (m) => new AvailabilityId(m.id),
    );
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((existingId) => existingId.equals(id)),
    );

    return {
      exists: existingIds,
      not_exists: notExistingIds,
    };
  }

  async search(
    props: AvailabilitySearchParams,
  ): Promise<AvailabilitySearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const { musicians, bands, total } = await this.searchSettings(
      props.filter,
      offset,
      limit,
    );

    const settings = [...musicians, ...bands] as any[];
    const items = await Promise.all(settings.map((s) => this.mapToEntity(s)));

    return new AvailabilitySearchResult({
      items,
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private async searchSettings(
    filter: AvailabilityFilter | null | undefined,
    offset: number,
    limit: number,
  ): Promise<{
    musicians: CalendarSettingsModel[];
    bands: CalendarSettingsModel[];
    total: number;
  }> {
    if (filter?.musician_id) {
      const where: any = { musicianId: filter.musician_id };
      if (typeof filter.is_active === "boolean")
        where.is_active = filter.is_active;
      const [items, total] = await Promise.all([
        this.prisma.musicianCalendarSettings.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { created_at: "desc" },
        }),
        this.prisma.musicianCalendarSettings.count({ where }),
      ]);
      return { musicians: items as any, bands: [], total };
    }

    if (filter?.band_id) {
      const where: any = { bandId: filter.band_id };
      if (typeof filter.is_active === "boolean")
        where.is_active = filter.is_active;
      const [items, total] = await Promise.all([
        this.prisma.bandCalendarSettings.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { created_at: "desc" },
        }),
        this.prisma.bandCalendarSettings.count({ where }),
      ]);
      return { musicians: [], bands: items as any, total };
    }

    const musicianWhere: any = {};
    const bandWhere: any = {};
    if (typeof filter?.is_active === "boolean") {
      musicianWhere.is_active = filter.is_active;
      bandWhere.is_active = filter.is_active;
    }

    const [musiciansAll, bandsAll, musiciansCount, bandsCount] =
      await Promise.all([
        this.prisma.musicianCalendarSettings.findMany({
          where: musicianWhere,
          orderBy: { created_at: "desc" },
        }),
        this.prisma.bandCalendarSettings.findMany({
          where: bandWhere,
          orderBy: { created_at: "desc" },
        }),
        this.prisma.musicianCalendarSettings.count({ where: musicianWhere }),
        this.prisma.bandCalendarSettings.count({ where: bandWhere }),
      ]);

    const combined = [...musiciansAll, ...bandsAll].sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime(),
    );
    const pageSlice = combined.slice(offset, offset + limit);

    const musicians = pageSlice.filter((s: any) => !!s.musicianId);
    const bands = pageSlice.filter((s: any) => !!s.bandId);

    return {
      musicians: musicians as any,
      bands: bands as any,
      total: musiciansCount + bandsCount,
    };
  }

  private async findTargetById(
    entity_id: AvailabilityId,
  ): Promise<CalendarSettingsModel | null> {
    const settings = await this.prisma.musicianCalendarSettings.findUnique({
      where: { id: entity_id.id },
    });
    if (settings) return settings as any;

    const bandSettings = await this.prisma.bandCalendarSettings.findUnique({
      where: { id: entity_id.id },
    });
    return bandSettings ? (bandSettings as any) : null;
  }

  private async mapToEntity(
    settings: CalendarSettingsModel,
  ): Promise<Availability> {
    const targetMusicianId = (settings as any).musicianId ?? null;
    const targetBandId = (settings as any).bandId ?? null;

    const weeklyRules = targetMusicianId
      ? await this.prisma.musicianAvailabilityRule.findMany({
          where: { musicianId: targetMusicianId },
          orderBy: [{ weekday: "asc" }, { start_time: "asc" }],
        })
      : targetBandId
        ? await this.prisma.bandAvailabilityRule.findMany({
            where: { bandId: targetBandId },
            orderBy: [{ weekday: "asc" }, { start_time: "asc" }],
          })
        : [];

    const unavailabilities = targetMusicianId
      ? await this.prisma.musicianUnavailability.findMany({
          where: { musicianId: targetMusicianId },
          orderBy: { start_at: "asc" },
        })
      : await this.prisma.bandUnavailability.findMany({
          where: { bandId: targetBandId },
          orderBy: { start_at: "asc" },
        });

    return AvailabilityModelMapper.toEntity(
      settings,
      weeklyRules as any[],
      unavailabilities as any[],
    );
  }

  getEntity(): new (...args: any[]) => Availability {
    return Availability;
  }
}
