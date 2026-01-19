import { Prisma, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Request, RequestId } from "../../../domain/request.aggregate";
import {
  IRequestRepository,
  RequestFilter,
  RequestSearchParams,
  RequestSearchResult,
} from "../../../domain/request.repository";
import { RequestModelMapper } from "./request-model.mapper";

export class RequestPrismaRepository implements IRequestRepository {
  sortableFields: string[] = [
    "created_at",
    "updated_at",
    "respondedAt",
    "playedAt",
    "songTitle",
    "votesCount",
    "priority",
  ];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Request): Promise<void> {
    const modelProps = RequestModelMapper.toModel(entity);
    await this.prisma.musicRequest.create({
      data: modelProps,
    });
  }

  async bulkInsert(entities: Request[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      RequestModelMapper.toModel(entity),
    );
    await this.prisma.musicRequest.createMany({
      data: modelsProps,
    });
  }

  async update(entity: Request): Promise<void> {
    const id = entity.request_id.id;
    const modelProps = RequestModelMapper.toModel(entity);

    try {
      await this.prisma.musicRequest.update({
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

  async delete(id: RequestId): Promise<void> {
    const requestId = id.id;

    try {
      await this.prisma.musicRequest.delete({
        where: { id: requestId },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundError(id.id, this.getEntity());
      }
      throw error;
    }
  }

  async findById(entity_id: RequestId): Promise<Request | null> {
    const model = await this.prisma.musicRequest.findUnique({
      where: { id: entity_id.id },
    });

    return model ? RequestModelMapper.toEntity(model) : null;
  }

  async findByIds(ids: RequestId[]): Promise<Request[]> {
    const models = await this.prisma.musicRequest.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((m) => RequestModelMapper.toEntity(m));
  }

  async findAll(): Promise<Request[]> {
    const models = await this.prisma.musicRequest.findMany();
    return models.map((model) => RequestModelMapper.toEntity(model));
  }

  async existsById(
    ids: RequestId[],
  ): Promise<{ exists: RequestId[]; not_exists: RequestId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.prisma.musicRequest.findMany({
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

  async search(props: RequestSearchParams): Promise<RequestSearchResult> {
    if (props.sort === "priority") {
      const conditions: Prisma.Sql[] = [];
      const filter = props.filter;

      if (filter?.event_id) {
        conditions.push(Prisma.sql`"eventId" = ${filter.event_id}`);
      }
      if (filter?.audience_id) {
        conditions.push(Prisma.sql`"audienceId" = ${filter.audience_id}`);
      }
      if (filter?.musician_id) {
        conditions.push(Prisma.sql`"musicianId" = ${filter.musician_id}`);
      }
      if (filter?.status) {
        conditions.push(Prisma.sql`"status" = ${filter.status}`);
      }
      if (filter?.song_title) {
        conditions.push(
          Prisma.sql`"songTitle" ILIKE ${`%${filter.song_title}%`}`,
        );
      }
      if (filter?.artist) {
        conditions.push(Prisma.sql`"artistName" ILIKE ${`%${filter.artist}%`}`);
      }
      if (filter?.created_after) {
        conditions.push(Prisma.sql`"created_at" >= ${filter.created_after}`);
      }
      if (filter?.created_before) {
        conditions.push(Prisma.sql`"created_at" <= ${filter.created_before}`);
      }

      const whereSql =
        conditions.length > 0
          ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
          : Prisma.sql``;

      const priorityExpr = Prisma.sql`CASE
        WHEN "status" = 'pending' AND NOW() - "created_at" > interval '15 minutes' THEN 2
        WHEN NOW() - "created_at" > interval '30 minutes' THEN 1
        ELSE 0
      END`;

      const orderDirSql =
        props.sort_dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

      const offset = (props.page - 1) * props.per_page;
      const limit = props.per_page;

      const [rows, countRows] = await Promise.all([
        this.prisma.$queryRaw(
          Prisma.sql`
            SELECT
              "id",
              "eventId",
              "audienceId",
              "musicianId",
              "libraryId",
              "songTitle",
              "artistName",
              "message",
              "status",
              "rejectionReason",
              "priority",
              "votesCount",
              "playedAt",
              "respondedAt",
              "created_at",
              "updated_at"
            FROM "music_requests"
            ${whereSql}
            ORDER BY ${priorityExpr} ${orderDirSql}, "created_at" DESC
            OFFSET ${offset}
            LIMIT ${limit}
          `,
        ),
        this.prisma.$queryRaw(
          Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "music_requests"
            ${whereSql}
          `,
        ),
      ]);

      const total = Number((countRows as any)[0]?.count ?? 0);
      const items = (rows as any[]).map((row) =>
        RequestModelMapper.toEntity(row),
      );

      return new RequestSearchResult({
        items,
        total,
        current_page: props.page,
        per_page: props.per_page,
      });
    }

    const where = this.buildWhereClause(props.filter);

    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [models, count] = await Promise.all([
      this.prisma.musicRequest.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.musicRequest.count({ where }),
    ]);

    const items = models.map((model) => RequestModelMapper.toEntity(model));

    return new RequestSearchResult({
      items,
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  // Métodos específicos do domínio Request
  async findByAudienceId(audience_id: string): Promise<Request[]> {
    const models = await this.prisma.musicRequest.findMany({
      where: { audienceId: audience_id },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => RequestModelMapper.toEntity(model));
  }

  async findByMusicianId(musician_id: string): Promise<Request[]> {
    const models = await this.prisma.musicRequest.findMany({
      where: { musicianId: musician_id },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => RequestModelMapper.toEntity(model));
  }

  async findByStatus(status: string): Promise<Request[]> {
    const models = await this.prisma.musicRequest.findMany({
      where: { status },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => RequestModelMapper.toEntity(model));
  }

  async findPendingRequests(musician_id?: string): Promise<Request[]> {
    const where: any = { status: "pending" };
    if (musician_id) {
      where.musicianId = musician_id;
    }

    const models = await this.prisma.musicRequest.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => RequestModelMapper.toEntity(model));
  }

  async findPendingRequestsByMusician(musician_id: string): Promise<Request[]> {
    const models = await this.prisma.musicRequest.findMany({
      where: {
        musicianId: musician_id,
        status: "pending",
      },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => RequestModelMapper.toEntity(model));
  }

  async findAcceptedRequestsByMusician(
    musician_id: string,
  ): Promise<Request[]> {
    const models = await this.prisma.musicRequest.findMany({
      where: {
        musicianId: musician_id,
        status: "accepted",
      },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => RequestModelMapper.toEntity(model));
  }

  async findRejectedRequestsByMusician(
    musician_id: string,
  ): Promise<Request[]> {
    const models = await this.prisma.musicRequest.findMany({
      where: {
        musicianId: musician_id,
        status: "rejected",
      },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => RequestModelMapper.toEntity(model));
  }

  async findRequestsByAudienceAndMusician(
    audience_id: string,
    musician_id: string,
    event_id?: string,
  ): Promise<Request[]> {
    const models = await this.prisma.musicRequest.findMany({
      where: {
        audienceId: audience_id,
        musicianId: musician_id,
        ...(event_id ? { eventId: event_id } : {}),
      },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => RequestModelMapper.toEntity(model));
  }

  async findPendingRequestsByAudienceAndMusician(
    audience_id: string,
    musician_id: string,
    event_id?: string,
  ): Promise<Request[]> {
    const models = await this.prisma.musicRequest.findMany({
      where: {
        audienceId: audience_id,
        musicianId: musician_id,
        status: "pending",
        ...(event_id ? { eventId: event_id } : {}),
      },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => RequestModelMapper.toEntity(model));
  }

  async countByMusicianId(musicianId: Uuid): Promise<number> {
    return await this.prisma.musicRequest.count({
      where: { musicianId: musicianId.id },
    });
  }

  async countByStatus(status: string): Promise<number> {
    return this.prisma.musicRequest.count({
      where: { status },
    });
  }

  async countRequestsByAudienceToday(audience_id: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.prisma.musicRequest.count({
      where: {
        audienceId: audience_id,
        created_at: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
  }

  async countRequestsByAudienceInPeriod(
    audience_id: string,
    start_date: Date,
    end_date: Date,
  ): Promise<number> {
    return await this.prisma.musicRequest.count({
      where: {
        audienceId: audience_id,
        created_at: {
          gte: start_date,
          lte: end_date,
        },
      },
    });
  }

  async countRequestsByAudienceInPeriodForEvent(
    audience_id: string,
    event_id: string,
    start_date: Date,
    end_date: Date,
  ): Promise<number> {
    return await this.prisma.musicRequest.count({
      where: {
        audienceId: audience_id,
        eventId: event_id,
        created_at: {
          gte: start_date,
          lte: end_date,
        },
      },
    });
  }

  async countPendingRequestsByMusician(musician_id: string): Promise<number> {
    return await this.prisma.musicRequest.count({
      where: {
        musicianId: musician_id,
        status: "pending",
      },
    });
  }

  async findRecentRequestsByAudience(
    audience_id: string,
    hours_limit: number = 2,
  ): Promise<Request[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours_limit);

    const models = await this.prisma.musicRequest.findMany({
      where: {
        audienceId: audience_id,
        created_at: {
          gte: cutoffTime,
        },
      },
      orderBy: { created_at: "desc" },
    });
    return models.map((model) => RequestModelMapper.toEntity(model));
  }

  async findPopularSongs(
    musician_id?: string,
    limit: number = 10,
  ): Promise<{ song_title: string; artist?: string; count: number }[]> {
    const where: any = {};
    if (musician_id) {
      where.musicianId = musician_id;
    }

    const result = await this.prisma.musicRequest.groupBy({
      by: ["songTitle", "artistName"],
      where,
      _count: {
        songTitle: true,
      },
      orderBy: {
        _count: {
          songTitle: "desc",
        },
      },
      take: limit,
    });

    return result.map((item) => ({
      song_title: item.songTitle,
      artist: item.artistName,
      count: item._count.songTitle,
    }));
  }

  private buildWhereClause(filter?: RequestFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.event_id) {
      where.eventId = filter.event_id;
    }

    if (filter.audience_id) {
      where.audienceId = filter.audience_id;
    }

    if (filter.musician_id) {
      where.musicianId = filter.musician_id;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.song_title) {
      where.songTitle = {
        contains: filter.song_title,
        mode: "insensitive",
      };
    }

    if (filter.artist) {
      where.artistName = {
        contains: filter.artist,
        mode: "insensitive",
      };
    }

    if (filter.created_after) {
      where.created_at = {
        ...where.created_at,
        gte: filter.created_after,
      };
    }

    if (filter.created_before) {
      where.created_at = {
        ...where.created_at,
        lte: filter.created_before,
      };
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

  getEntity(): new (...args: any[]) => Request {
    return Request;
  }
}
