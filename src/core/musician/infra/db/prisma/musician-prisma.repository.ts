import { CurrencyEnum, Prisma, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import {
  boundingBoxForRadius,
  haversineKm,
} from "../../../../shared/domain/geo.utils";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import {
  IMusicianRepository,
  MusicianFilter,
  MusicianSearchParams,
  MusicianSearchResult,
} from "../../../domain/musician.repository";
import { MusicianModel } from "./musician-model";
import { MusicianModelMapper } from "./musician-model-mapper";

export class MusicianPrismaRepository implements IMusicianRepository {
  sortableFields: string[] = ["name", "stage_name", "created_at", "rating"];

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

  private toPrismaRequiredJson(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
    if (value === null) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private toPrismaOptionalJson(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value === null) {
      return Prisma.DbNull;
    }
    return value as Prisma.InputJsonValue;
  }

  async insert(entity: Musician): Promise<void> {
    const modelProps = MusicianModelMapper.toModel(entity);
    const profileModel = entity.profile
      ? MusicianModelMapper.toProfileModel(entity.profile)
      : null;

    const profileCreateData = profileModel
      ? {
          ...(({ musicianId, ...data }) => data)(profileModel),
          price_currency: this.toPrismaCurrency(profileModel.price_currency),
          location: this.toPrismaRequiredJson(profileModel.location),
          touring_location: this.toPrismaOptionalJson(
            profileModel.touring_location,
          ),
          socialLinks: this.toPrismaOptionalJson(profileModel.socialLinks),
        }
      : null;

    try {
      await this.prisma.musician.create({
        data: {
          ...modelProps,
          profile: profileCreateData
            ? {
                create: {
                  ...profileCreateData,
                },
              }
            : undefined,
        },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.musician_id.id,
        operation: "musician.create",
      });
    }
  }

  async bulkInsert(entities: Musician[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      MusicianModelMapper.toModel(entity),
    );
    try {
      await this.prisma.musician.createMany({
        data: modelsProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "musician.createMany",
      });
    }
  }

  async update(entity: Musician): Promise<void> {
    const id = entity.musician_id.id;
    const modelProps = MusicianModelMapper.toModel(entity);
    const profileModel = entity.profile
      ? MusicianModelMapper.toProfileModel(entity.profile)
      : null;

    const profileCreateData = profileModel
      ? {
          ...(({ musicianId, ...data }) => data)(profileModel),
          price_currency: this.toPrismaCurrency(profileModel.price_currency),
          location: this.toPrismaRequiredJson(profileModel.location),
          touring_location: this.toPrismaOptionalJson(
            profileModel.touring_location,
          ),
          socialLinks: this.toPrismaOptionalJson(profileModel.socialLinks),
        }
      : null;
    const profileUpdateData = profileModel
      ? {
          ...(({ musicianId, id: profileId, ...data }) => data)(profileModel),
          price_currency: this.toPrismaCurrency(profileModel.price_currency),
          location: this.toPrismaRequiredJson(profileModel.location),
          touring_location: this.toPrismaOptionalJson(
            profileModel.touring_location,
          ),
          socialLinks: this.toPrismaOptionalJson(profileModel.socialLinks),
        }
      : null;

    try {
      await this.prisma.musician.update({
        where: { id: id },
        data: {
          ...modelProps,
          profile:
            profileCreateData && profileUpdateData
              ? {
                  upsert: {
                    create: { ...profileCreateData },
                    update: { ...profileUpdateData },
                  },
                }
              : undefined,
        },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "musician.update",
      });
    }
  }

  async delete(id: MusicianId): Promise<void> {
    const musicianId = id.id;

    try {
      await this.prisma.musician.delete({
        where: { id: musicianId },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "musician.delete",
      });
    }
  }

  async findById(entity_id: MusicianId): Promise<Musician | null> {
    const model = await this.prisma.musician.findUnique({
      where: { id: entity_id.id },
      include: { profile: true },
    });

    return model
      ? MusicianModelMapper.toEntity(model as unknown as MusicianModel)
      : null;
  }

  async findByEmail(email: string): Promise<Musician | null> {
    const model = await this.prisma.musician.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { profile: true },
    });

    return model
      ? MusicianModelMapper.toEntity(model as unknown as MusicianModel)
      : null;
  }

  async findByCpf(cpf: string): Promise<Musician | null> {
    const model = await this.prisma.musician.findFirst({
      where: { cpf },
      include: { profile: true },
    });

    return model
      ? MusicianModelMapper.toEntity(model as unknown as MusicianModel)
      : null;
  }

  async findByPhone(phone: string): Promise<Musician | null> {
    const model = await this.prisma.musician.findFirst({
      where: { phone },
      include: { profile: true },
    });

    return model
      ? MusicianModelMapper.toEntity(model as unknown as MusicianModel)
      : null;
  }

  async findByIds(ids: MusicianId[]): Promise<Musician[]> {
    const models = await this.prisma.musician.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      include: { profile: true },
    });
    return models.map((m) =>
      MusicianModelMapper.toEntity(m as unknown as MusicianModel),
    );
  }

  async findAll(): Promise<Musician[]> {
    const models = await this.prisma.musician.findMany({
      include: { profile: true },
    });
    return models.map((model) =>
      MusicianModelMapper.toEntity(model as unknown as MusicianModel),
    );
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
    const geo = props.filter;
    if (
      geo?.lat !== null &&
      geo?.lat !== undefined &&
      geo?.lng !== null &&
      geo?.lng !== undefined &&
      geo?.radius_km !== null &&
      geo?.radius_km !== undefined
    ) {
      return this.searchByProximity(props, geo.lat, geo.lng, geo.radius_km);
    }

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
        include: { profile: true },
      }),
      this.prisma.musician.count({ where }),
    ]);

    const entities = musicians.map((m) =>
      MusicianModelMapper.toEntity(m as unknown as MusicianModel),
    );

    return new MusicianSearchResult({
      items: entities,
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  // Busca por proximidade (roadmap 7.13c): bounding box indexável em SQL
  // (colunas denormalizadas location_lat/location_lng no profile, índice
  // composto) como pré-filtro + Haversine exato em memória para o corte
  // circular e ordenação por distância. Duas queries (ids→página) para manter
  // paginação/total exatos sem SQL cru — mesmo desenho do
  // EstablishmentPrismaRepository.searchByProximity.
  // 7.13d — modo turnê: considera OS DOIS pontos (base OU turnê ainda
  // ativo), usando a menor distância como corte/ordenação. Nunca substitui
  // a base, só amplia onde o músico pode ser encontrado.
  private async searchByProximity(
    props: MusicianSearchParams,
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<MusicianSearchResult> {
    const where = this.buildWhereClause(props.filter);
    const box = boundingBoxForRadius(lat, lng, radiusKm);
    const now = new Date();
    where.profile = {
      is: {
        ...(where.profile?.is ?? {}),
        OR: [
          {
            location_lat: { gte: box.min_lat, lte: box.max_lat },
            location_lng: { gte: box.min_lng, lte: box.max_lng },
          },
          {
            touring_lat: { gte: box.min_lat, lte: box.max_lat },
            touring_lng: { gte: box.min_lng, lte: box.max_lng },
            touring_expires_at: { gt: now },
          },
        ],
      },
    };

    const candidates = await this.prisma.musician.findMany({
      where,
      select: {
        id: true,
        profile: {
          select: {
            location_lat: true,
            location_lng: true,
            touring_lat: true,
            touring_lng: true,
            touring_expires_at: true,
          },
        },
      },
    });

    const withinRadius = candidates
      .map((candidate) => {
        const profile = candidate.profile!;
        const distances: number[] = [];
        if (profile.location_lat !== null && profile.location_lng !== null) {
          distances.push(
            haversineKm(lat, lng, profile.location_lat, profile.location_lng),
          );
        }
        if (
          profile.touring_lat !== null &&
          profile.touring_lng !== null &&
          profile.touring_expires_at !== null &&
          profile.touring_expires_at.getTime() > now.getTime()
        ) {
          distances.push(
            haversineKm(lat, lng, profile.touring_lat, profile.touring_lng),
          );
        }
        return { id: candidate.id, distance: Math.min(...distances) };
      })
      .filter((candidate) => candidate.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    const offset = (props.page - 1) * props.per_page;
    const pageIds = withinRadius
      .slice(offset, offset + props.per_page)
      .map((candidate) => candidate.id);

    const models = pageIds.length
      ? await this.prisma.musician.findMany({
          where: { id: { in: pageIds } },
          include: { profile: true },
        })
      : [];
    const modelById = new Map(models.map((model) => [model.id, model]));
    const items = pageIds
      .map((id) => modelById.get(id))
      .filter((model): model is NonNullable<typeof model> => !!model)
      .map((model) =>
        MusicianModelMapper.toEntity(model as unknown as MusicianModel),
      );

    return new MusicianSearchResult({
      items,
      total: withinRadius.length,
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

    const profileWhere: any = {};
    const prismaCurrency = this.toPrismaCurrency(filter.price_currency ?? null);

    if (prismaCurrency) {
      profileWhere.price_currency = prismaCurrency;
    }

    const hasPriceMin =
      filter.price_min !== null &&
      filter.price_min !== undefined &&
      Number.isFinite(filter.price_min);
    const hasPriceMax =
      filter.price_max !== null &&
      filter.price_max !== undefined &&
      Number.isFinite(filter.price_max);

    // Faixas por modelo vivem em pares de colunas (price_hour_* /
    // price_event_*). Com price_model no filtro, exige a faixa daquele modelo
    // (e o overlap min/max nela); sem price_model, o overlap vale para
    // qualquer um dos dois modelos (OR).
    const modelOverlapClause = (model: "per_hour" | "per_event") => {
      const prefix = model === "per_hour" ? "price_hour" : "price_event";
      const clause: any = { [`${prefix}_min`]: { not: null } };
      if (hasPriceMin) clause[`${prefix}_max`] = { gte: filter.price_min };
      if (hasPriceMax) clause[`${prefix}_min`] = { lte: filter.price_max };
      return clause;
    };

    if (filter.price_model) {
      Object.assign(profileWhere, modelOverlapClause(filter.price_model));
    } else if (hasPriceMin || hasPriceMax) {
      profileWhere.OR = [
        modelOverlapClause("per_hour"),
        modelOverlapClause("per_event"),
      ];
    }

    if (Object.keys(profileWhere).length) {
      where.profile = {
        is: profileWhere,
      };
    }

    if (filter.is_active !== undefined) {
      where.is_active = filter.is_active;
    }

    if (filter.is_verified !== undefined) {
      where.is_verified = filter.is_verified;
    }

    if (filter.open_to_gigs !== undefined) {
      where.open_to_gigs = filter.open_to_gigs;
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
