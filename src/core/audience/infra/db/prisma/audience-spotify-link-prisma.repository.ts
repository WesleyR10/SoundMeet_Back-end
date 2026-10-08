import { Prisma, PrismaClient } from "@prisma/client";

import { IEncryptionService } from "../../../../shared/domain/encryption.service";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { IUnitOfWork } from "../../../../shared/domain/repository/unit-of-work.interface";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  AudienceSpotifyLink,
  AudienceSpotifyLinkId,
} from "../../../domain/audience-spotify-link.aggregate";
import {
  AudienceSpotifyLinkFilter,
  AudienceSpotifyLinkSearchParams,
  AudienceSpotifyLinkSearchResult,
  IAudienceSpotifyLinkRepository,
} from "../../../domain/audience-spotify-link.repository";
import { AudienceSpotifyLinkModelMapper } from "./audience-spotify-link-model.mapper";

/** Nomes de ordenação do domínio → colunas do Prisma. */
const SORT_COLUMN: Record<string, string> = {
  created_at: "created_at",
  expires_at: "expiresAt",
};

export class AudienceSpotifyLinkPrismaRepository implements IAudienceSpotifyLinkRepository {
  sortableFields: string[] = Object.keys(SORT_COLUMN);

  private readonly mapper: AudienceSpotifyLinkModelMapper;

  constructor(
    private prisma: PrismaClient,
    encryption: IEncryptionService,
    private readonly uow?: IUnitOfWork<Prisma.TransactionClient>,
  ) {
    this.mapper = new AudienceSpotifyLinkModelMapper(encryption);
  }

  private get client(): PrismaClient | Prisma.TransactionClient {
    return this.uow?.getTransaction() ?? this.prisma;
  }

  async insert(entity: AudienceSpotifyLink): Promise<void> {
    try {
      await this.client.audienceSpotifyLink.create({
        data: this.mapper.toModel(entity),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.link_id.id,
        operation: "audienceSpotifyLink.create",
      });
    }
  }

  async bulkInsert(entities: AudienceSpotifyLink[]): Promise<void> {
    try {
      await this.client.audienceSpotifyLink.createMany({
        data: entities.map((e) => this.mapper.toModel(e)),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "audienceSpotifyLink.createMany",
      });
    }
  }

  async update(entity: AudienceSpotifyLink): Promise<void> {
    try {
      await this.client.audienceSpotifyLink.update({
        where: { id: entity.link_id.id },
        data: this.mapper.toModel(entity),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.link_id.id,
        operation: "audienceSpotifyLink.update",
      });
    }
  }

  async delete(entity_id: AudienceSpotifyLinkId): Promise<void> {
    try {
      await this.client.audienceSpotifyLink.delete({
        where: { id: entity_id.id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity_id.id,
        operation: "audienceSpotifyLink.delete",
      });
    }
  }

  async findById(
    entity_id: AudienceSpotifyLinkId,
  ): Promise<AudienceSpotifyLink | null> {
    const model = await this.client.audienceSpotifyLink.findUnique({
      where: { id: entity_id.id },
    });
    return model ? this.mapper.toEntity(model) : null;
  }

  async findAll(): Promise<AudienceSpotifyLink[]> {
    const models = await this.client.audienceSpotifyLink.findMany();
    return models.map((m) => this.mapper.toEntity(m));
  }

  async findByIds(
    ids: AudienceSpotifyLinkId[],
  ): Promise<AudienceSpotifyLink[]> {
    const models = await this.client.audienceSpotifyLink.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
    });
    return models.map((m) => this.mapper.toEntity(m));
  }

  async existsById(ids: AudienceSpotifyLinkId[]): Promise<{
    exists: AudienceSpotifyLinkId[];
    not_exists: AudienceSpotifyLinkId[];
  }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existing = await this.client.audienceSpotifyLink.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
      select: { id: true },
    });
    const existingIds = existing.map((m) => m.id);

    return {
      exists: ids.filter((i) => existingIds.includes(i.id)),
      not_exists: ids.filter((i) => !existingIds.includes(i.id)),
    };
  }

  async search(
    props: AudienceSpotifyLinkSearchParams,
  ): Promise<AudienceSpotifyLinkSearchResult> {
    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [models, count] = await Promise.all([
      this.client.audienceSpotifyLink.findMany({
        where,
        orderBy,
        skip: (props.page - 1) * props.per_page,
        take: props.per_page,
      }),
      this.client.audienceSpotifyLink.count({ where }),
    ]);

    return new AudienceSpotifyLinkSearchResult({
      items: models.map((m) => this.mapper.toEntity(m)),
      current_page: props.page,
      per_page: props.per_page,
      total: count,
    });
  }

  async findByAudienceId(
    audienceId: string,
  ): Promise<AudienceSpotifyLink | null> {
    const model = await this.client.audienceSpotifyLink.findUnique({
      where: { audienceId },
    });
    return model ? this.mapper.toEntity(model) : null;
  }

  async findExpiring(
    before: Date,
    limit: number,
  ): Promise<AudienceSpotifyLink[]> {
    const models = await this.client.audienceSpotifyLink.findMany({
      where: { expiresAt: { lte: before } },
      orderBy: { expiresAt: "asc" },
      take: limit,
    });
    return models.map((m) => this.mapper.toEntity(m));
  }

  /**
   * `deleteMany` e não `delete`: desvincular precisa ser idempotente. Tocar duas
   * vezes no botão, ou uma reentrega de requisição, não pode virar 404 — o
   * estado desejado ("não vinculado") já foi alcançado na primeira.
   */
  async deleteByAudienceId(audienceId: string): Promise<void> {
    await this.client.audienceSpotifyLink.deleteMany({ where: { audienceId } });
  }

  getEntity(): new (...args: any[]) => AudienceSpotifyLink {
    return AudienceSpotifyLink;
  }

  private buildWhereClause(filter: AudienceSpotifyLinkFilter | null) {
    if (!filter) return {};

    const where: any = {};
    if (filter.audience_id) where.audienceId = filter.audience_id;
    return where;
  }

  private buildOrderByClause(
    sort: string | null,
    sort_dir: "asc" | "desc" | null,
  ) {
    const column = sort ? SORT_COLUMN[sort] : undefined;
    if (column) {
      return { [column]: sort_dir || "asc" };
    }
    return { created_at: sort_dir || "desc" };
  }
}
