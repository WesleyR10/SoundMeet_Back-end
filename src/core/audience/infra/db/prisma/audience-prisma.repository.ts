import { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import {
  AudienceFilter,
  AudienceSearchParams,
  AudienceSearchResult,
  IAudienceRepository,
} from "../../../domain/audience.repository";
import { AudienceModelMapper } from "./audience-model-mapper";

export class AudiencePrismaRepository implements IAudienceRepository {
  sortableFields: string[] = ["name", "email", "points", "level", "created_at"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Audience): Promise<void> {
    const modelProps = AudienceModelMapper.toModel(entity);
    await this.prisma.audience.create({
      data: {
        id: modelProps.id,
        email: modelProps.email,
        name: modelProps.name,
        nickname: modelProps.nickname,
        avatar: modelProps.avatar,
        phone: modelProps.phone,
        points: modelProps.points,
        monthly_points: modelProps.monthly_points,
        level: modelProps.level,
        favorite_genres: modelProps.favorite_genres,
        favorite_artists: modelProps.favorite_artists,
        preferred_languages: modelProps.preferred_languages,
        notification_settings: modelProps.notification_settings,
        privacy_settings: modelProps.privacy_settings,
        discovery_settings: modelProps.discovery_settings,
        is_active: modelProps.is_active,
        created_at: modelProps.created_at,
        updated_at: modelProps.updated_at,
      },
    });
  }

  async bulkInsert(entities: Audience[]): Promise<void> {
    const modelsProps = entities.map((entity) => {
      const modelProps = AudienceModelMapper.toModel(entity);
      return {
        id: modelProps.id,
        email: modelProps.email,
        name: modelProps.name,
        nickname: modelProps.nickname,
        avatar: modelProps.avatar,
        phone: modelProps.phone,
        points: modelProps.points,
        monthly_points: modelProps.monthly_points,
        level: modelProps.level,
        favorite_genres: modelProps.favorite_genres,
        favorite_artists: modelProps.favorite_artists,
        preferred_languages: modelProps.preferred_languages,
        notification_settings: modelProps.notification_settings,
        privacy_settings: modelProps.privacy_settings,
        discovery_settings: modelProps.discovery_settings,
        is_active: modelProps.is_active,
        created_at: modelProps.created_at,
        updated_at: modelProps.updated_at,
      };
    });
    await this.prisma.audience.createMany({
      data: modelsProps,
    });
  }

  async update(entity: Audience): Promise<void> {
    const id = entity.id.id;
    const modelProps = AudienceModelMapper.toModel(entity);

    try {
      await this.prisma.audience.update({
        where: { id },
        data: {
          email: modelProps.email,
          name: modelProps.name,
          nickname: modelProps.nickname,
          avatar: modelProps.avatar,
          phone: modelProps.phone,
          points: modelProps.points,
          monthly_points: modelProps.monthly_points,
          level: modelProps.level,
          favorite_genres: modelProps.favorite_genres,
          favorite_artists: modelProps.favorite_artists,
          preferred_languages: modelProps.preferred_languages,
          notification_settings: modelProps.notification_settings,
          privacy_settings: modelProps.privacy_settings,
          discovery_settings: modelProps.discovery_settings,
          is_active: modelProps.is_active,
          updated_at: modelProps.updated_at,
        },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(id, this.getEntity());
      }
      throw error;
    }
  }

  async delete(id: AudienceId): Promise<void> {
    const _id = id.id;
    try {
      await this.prisma.audience.delete({
        where: { id: _id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(_id, this.getEntity());
      }
      throw error;
    }
  }

  async findById(id: AudienceId): Promise<Audience | null> {
    const model = await this.prisma.audience.findUnique({
      where: { id: id.id },
      include: {
        badges: {
          include: {
            badge: true,
          },
        },
      },
    });
    return model ? this.mapToEntityWithBadges(model) : null;
  }

  async findByIds(ids: AudienceId[]): Promise<Audience[]> {
    const models = await this.prisma.audience.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      include: {
        badges: {
          include: {
            badge: true,
          },
        },
      },
    });
    return models.map((model) => this.mapToEntityWithBadges(model));
  }

  async findAll(): Promise<Audience[]> {
    const models = await this.prisma.audience.findMany({
      include: {
        badges: {
          include: {
            badge: true,
          },
        },
      },
    });
    return models.map((model) => this.mapToEntityWithBadges(model));
  }

  async existsById(ids: AudienceId[]): Promise<{
    exists: AudienceId[];
    not_exists: AudienceId[];
  }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existsAudienceModels = await this.prisma.audience.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });
    const existsAudienceIds = existsAudienceModels.map((m) => m.id);
    const notExistsAudienceIds = ids
      .map((id) => id.id)
      .filter((id) => !existsAudienceIds.includes(id));
    return {
      exists: existsAudienceIds.map((id) => new AudienceId(id)),
      not_exists: notExistsAudienceIds.map((id) => new AudienceId(id)),
    };
  }

  async search(props: AudienceSearchParams): Promise<AudienceSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const { where, orderBy } = this.buildSearchQuery(props);

    const [models, count] = await Promise.all([
      this.prisma.audience.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          badges: {
            include: {
              badge: true,
            },
          },
        },
      }),
      this.prisma.audience.count({ where }),
    ]);

    const entities = models.map((model) => this.mapToEntityWithBadges(model));

    return new AudienceSearchResult({
      items: entities,
      current_page: props.page,
      per_page: props.per_page,
      total: count,
    });
  }

  private buildSearchQuery(props: AudienceSearchParams) {
    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);
    return { where, orderBy };
  }

  private buildWhereClause(filter: AudienceFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.name) {
      where.OR = [
        { name: { contains: filter.name, mode: "insensitive" } },
        { nickname: { contains: filter.name, mode: "insensitive" } },
        { email: { contains: filter.name, mode: "insensitive" } },
      ];
    }

    if (filter.email) {
      where.email = { contains: filter.email, mode: "insensitive" };
    }

    if (typeof filter.is_active === "boolean") {
      where.is_active = filter.is_active;
    }

    if (filter.favorite_genres && filter.favorite_genres.length > 0) {
      where.favorite_genres = {
        hasSome: filter.favorite_genres,
      };
    }

    if (typeof filter.min_points === "number") {
      where.points = { gte: filter.min_points };
    }

    if (typeof filter.min_level === "number") {
      where.level = { gte: filter.min_level };
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

  // Métodos específicos do domínio
  async findByEmail(email: string): Promise<Audience | null> {
    const model = await this.prisma.audience.findUnique({
      where: { email },
      include: {
        badges: {
          include: {
            badge: true,
          },
        },
      },
    });
    return model ? this.mapToEntityWithBadges(model) : null;
  }

  async findActiveAudiences(): Promise<Audience[]> {
    const models = await this.prisma.audience.findMany({
      where: { is_active: true },
      orderBy: { created_at: "desc" },
      include: {
        badges: {
          include: {
            badge: true,
          },
        },
      },
    });
    return models.map((model) => this.mapToEntityWithBadges(model));
  }

  async findByGenrePreference(genre: string): Promise<Audience[]> {
    const models = await this.prisma.audience.findMany({
      where: {
        favorite_genres: {
          has: genre,
        },
        is_active: true,
      },
      orderBy: { points: "desc" },
      include: {
        badges: {
          include: {
            badge: true,
          },
        },
      },
    });
    return models.map((model) => this.mapToEntityWithBadges(model));
  }

  async findTopFans(limit: number = 10): Promise<Audience[]> {
    const models = await this.prisma.audience.findMany({
      where: { is_active: true },
      orderBy: { points: "desc" },
      take: limit,
      include: {
        badges: {
          include: {
            badge: true,
          },
        },
      },
    });
    return models.map((model) => this.mapToEntityWithBadges(model));
  }

  async findByLevel(level: number): Promise<Audience[]> {
    const models = await this.prisma.audience.findMany({
      where: {
        level,
        is_active: true,
      },
      orderBy: { points: "desc" },
      include: {
        badges: {
          include: {
            badge: true,
          },
        },
      },
    });
    return models.map((model) => this.mapToEntityWithBadges(model));
  }

  async getAudienceStats(): Promise<{
    total_audiences: number;
    active_audiences: number;
    inactive_audiences: number;
  }> {
    const [total, active] = await Promise.all([
      this.prisma.audience.count(),
      this.prisma.audience.count({ where: { is_active: true } }),
    ]);

    return {
      total_audiences: total,
      active_audiences: active,
      inactive_audiences: total - active,
    };
  }

  async incrementTips(audienceId: AudienceId, amount: number): Promise<void> {
    await this.prisma.audience.update({
      where: { id: audienceId.id },
      data: {
        points: {
          increment: amount, // 1 ponto por real de gorjeta
        },
      },
    });
  }

  getEntity(): new (...args: any[]) => Audience {
    return Audience;
  }

  private mapToEntityWithBadges(model: any): Audience {
    const badges =
      model.badges?.map((userBadge: any) => userBadge.badge.name) || [];

    return AudienceModelMapper.toEntity({
      id: model.id,
      email: model.email,
      name: model.name,
      nickname: model.nickname,
      avatar: model.avatar,
      phone: model.phone,
      points: model.points,
      monthly_points: model.monthly_points,
      level: model.level,
      badges,
      favorite_genres: model.favorite_genres,
      favorite_artists: model.favorite_artists,
      preferred_languages: model.preferred_languages,
      notification_settings: model.notification_settings,
      privacy_settings: model.privacy_settings,
      discovery_settings: model.discovery_settings,
      location: model.location,
      social_links: model.social_links,
      is_active: model.is_active,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
