import { Prisma, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import {
  EstablishmentFilter,
  EstablishmentSearchParams,
  EstablishmentSearchResult,
  IEstablishmentRepository,
} from "../../../domain/establishment.repository";
import { EstablishmentProfile } from "../../../domain/establishment-profile.aggregate";
import { EstablishmentModelMapper } from "./establishment-model-mapper";

export class EstablishmentPrismaRepository implements IEstablishmentRepository {
  sortableFields: string[] = ["name", "created_at", "rating"];

  constructor(private prisma: PrismaClient) {}

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

  async insert(entity: Establishment): Promise<void> {
    const modelProps = EstablishmentModelMapper.toModel(entity);
    const profileModel = entity.profile
      ? EstablishmentModelMapper.toProfileModel(entity.profile)
      : null;
    const profileCreateData = profileModel
      ? {
          ...(({ establishmentId, ...data }) => data)(profileModel),
          location: this.toPrismaRequiredJson(profileModel.location),
          operatingHours: this.toPrismaOptionalJson(
            profileModel.operatingHours,
          ),
          priceRange: this.toPrismaOptionalJson(profileModel.priceRange),
          socialLinks: this.toPrismaOptionalJson(profileModel.socialLinks),
        }
      : null;
    try {
      await this.prisma.establishment.create({
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
        id: entity.establishment_id.id,
        operation: "establishment.create",
      });
    }
  }

  async bulkInsert(entities: Establishment[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      EstablishmentModelMapper.toModel(entity),
    );
    try {
      await this.prisma.establishment.createMany({
        data: modelsProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "establishment.createMany",
      });
    }
  }

  async update(entity: Establishment): Promise<void> {
    const id = entity.establishment_id.id;
    const modelProps = EstablishmentModelMapper.toModel(entity);

    const profileModel = entity.profile
      ? EstablishmentModelMapper.toProfileModel(entity.profile)
      : null;
    const profileCreateData = profileModel
      ? {
          ...(({ establishmentId, ...data }) => data)(profileModel),
          location: this.toPrismaRequiredJson(profileModel.location),
          operatingHours: this.toPrismaOptionalJson(
            profileModel.operatingHours,
          ),
          priceRange: this.toPrismaOptionalJson(profileModel.priceRange),
          socialLinks: this.toPrismaOptionalJson(profileModel.socialLinks),
        }
      : null;
    const profileUpdateData = profileModel
      ? {
          ...(({ establishmentId, id: profileId, ...data }) => data)(
            profileModel,
          ),
          location: this.toPrismaRequiredJson(profileModel.location),
          operatingHours: this.toPrismaOptionalJson(
            profileModel.operatingHours,
          ),
          priceRange: this.toPrismaOptionalJson(profileModel.priceRange),
          socialLinks: this.toPrismaOptionalJson(profileModel.socialLinks),
        }
      : null;

    try {
      await this.prisma.establishment.update({
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
        operation: "establishment.update",
      });
    }
  }

  async delete(establishment_id: EstablishmentId): Promise<void> {
    const id = establishment_id.id;

    try {
      await this.prisma.establishment.delete({
        where: { id: id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: establishment_id.id,
        operation: "establishment.delete",
      });
    }
  }

  async deleteProfile(establishment_id: EstablishmentId): Promise<void> {
    const id = establishment_id.id;
    try {
      await this.prisma.establishmentProfile.delete({
        where: {
          establishmentId: id,
        },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: EstablishmentProfile,
        id,
        operation: "establishmentProfile.delete",
      });
    }
  }

  async findById(entity_id: EstablishmentId): Promise<Establishment | null> {
    const model = await this.prisma.establishment.findUnique({
      where: { id: entity_id.id },
      include: { profile: true },
    });

    return model ? EstablishmentModelMapper.toEntity(model) : null;
  }

  async findByIds(ids: EstablishmentId[]): Promise<Establishment[]> {
    const models = await this.prisma.establishment.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      include: { profile: true },
    });

    return models.map((model) => EstablishmentModelMapper.toEntity(model));
  }

  async findAll(): Promise<Establishment[]> {
    const models = await this.prisma.establishment.findMany({
      include: { profile: true },
    });
    return models.map((model) => EstablishmentModelMapper.toEntity(model));
  }

  async existsById(
    ids: EstablishmentId[],
  ): Promise<{ exists: EstablishmentId[]; not_exists: EstablishmentId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existsEstablishmentModels = await this.prisma.establishment.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      select: {
        id: true,
      },
    });

    const existsEstablishmentIds = existsEstablishmentModels.map(
      (m) => new EstablishmentId(m.id),
    );
    const notExistsEstablishmentIds = ids.filter(
      (id) => !existsEstablishmentIds.some((e) => e.equals(id)),
    );
    return {
      exists: existsEstablishmentIds,
      not_exists: notExistsEstablishmentIds,
    };
  }

  async search(
    props: EstablishmentSearchParams,
  ): Promise<EstablishmentSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [models, count] = await Promise.all([
      this.prisma.establishment.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: { profile: true },
      }),
      this.prisma.establishment.count({ where }),
    ]);

    const items = models.map((model) =>
      EstablishmentModelMapper.toEntity(model),
    );

    return new EstablishmentSearchResult({
      items,
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private buildWhereClause(filter?: EstablishmentFilter | null) {
    if (!filter) return {};

    const orConditions: any[] = [];
    const andConditions: any = {};
    const profileWhere: any = {};

    if (filter.name) {
      orConditions.push({
        name: {
          contains: filter.name,
          mode: "insensitive",
        },
      });
    }

    if (filter.email) {
      orConditions.push({
        email: {
          contains: filter.email,
          mode: "insensitive",
        },
      });
    }

    if (filter.cnpj) {
      orConditions.push({
        cnpj: {
          contains: filter.cnpj,
        },
      });
    }

    if (typeof filter.is_active === "boolean") {
      andConditions.is_active = filter.is_active;
    }

    if (typeof filter.is_verified === "boolean") {
      andConditions.is_verified = filter.is_verified;
    }

    if (filter.location_city) {
      profileWhere.location_city = {
        contains: filter.location_city,
        mode: "insensitive",
      };
    }

    if (filter.amenities && filter.amenities.length > 0) {
      profileWhere.amenities = {
        hasSome: filter.amenities,
      };
    }

    if (filter.preferred_genres && filter.preferred_genres.length > 0) {
      profileWhere.preferredGenres = {
        hasSome: filter.preferred_genres,
      };
    }

    if (
      (filter.capacity_min !== null &&
        filter.capacity_min !== undefined &&
        Number.isFinite(filter.capacity_min)) ||
      (filter.capacity_max !== null &&
        filter.capacity_max !== undefined &&
        Number.isFinite(filter.capacity_max))
    ) {
      profileWhere.capacity = {
        ...(filter.capacity_min !== null &&
          filter.capacity_min !== undefined &&
          Number.isFinite(filter.capacity_min) && { gte: filter.capacity_min }),
        ...(filter.capacity_max !== null &&
          filter.capacity_max !== undefined &&
          Number.isFinite(filter.capacity_max) && { lte: filter.capacity_max }),
      };
    }

    const where: any = {};

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    if (Object.keys(andConditions).length > 0) {
      Object.assign(where, andConditions);
    }

    if (Object.keys(profileWhere).length > 0) {
      where.profile = {
        is: profileWhere,
      };
    }

    return where;
  }

  private buildOrderByClause(sort?: string | null, sort_dir?: string | null) {
    if (!sort) {
      return { created_at: "desc" as const };
    }

    if (!this.sortableFields.includes(sort)) {
      throw new InvalidArgumentError(`Invalid sort field: ${sort}`);
    }

    // Para o campo rating, precisamos mapear para o campo correto no Prisma
    const sortField = sort === "rating" ? "rating" : sort;

    return {
      [sortField]: sort_dir === "asc" ? ("asc" as const) : ("desc" as const),
    };
  }

  getEntity(): new (...args: any[]) => Establishment {
    return Establishment;
  }
}
