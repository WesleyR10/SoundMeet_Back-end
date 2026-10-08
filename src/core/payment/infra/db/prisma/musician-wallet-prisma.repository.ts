import { Prisma, PrismaClient } from "@prisma/client";

import { IEncryptionService } from "../../../../shared/domain/encryption.service";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { IUnitOfWork } from "../../../../shared/domain/repository/unit-of-work.interface";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { MusicianWallet } from "../../../domain/musician-wallet.aggregate";
import {
  IMusicianWalletRepository,
  MusicianWalletFilter,
  MusicianWalletSearchParams,
  MusicianWalletSearchResult,
} from "../../../domain/repositories/musician-wallet.repository";
import { MusicianWalletModelMapper } from "./musician-wallet-model.mapper";

export class MusicianWalletPrismaRepository implements IMusicianWalletRepository {
  sortableFields: string[] = ["created_at", "balance", "totalEarned"];
  private readonly mapper: MusicianWalletModelMapper;

  constructor(
    private prisma: PrismaClient,
    private readonly uow: IUnitOfWork<Prisma.TransactionClient> | undefined,
    encryption: IEncryptionService,
  ) {
    this.mapper = new MusicianWalletModelMapper(encryption);
  }

  private get client(): PrismaClient | Prisma.TransactionClient {
    return this.uow?.getTransaction() ?? this.prisma;
  }

  async insert(entity: MusicianWallet): Promise<void> {
    const modelProps = this.mapper.toModel(entity);
    try {
      await this.client.musicianWallet.create({
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.wallet_id.id,
        operation: "musicianWallet.create",
      });
    }
  }

  async bulkInsert(entities: MusicianWallet[]): Promise<void> {
    const modelsProps = entities.map((entity) => this.mapper.toModel(entity));
    try {
      await this.client.musicianWallet.createMany({
        data: modelsProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "musicianWallet.createMany",
      });
    }
  }

  async update(entity: MusicianWallet): Promise<void> {
    const modelProps = this.mapper.toModel(entity);
    try {
      await this.client.musicianWallet.update({
        where: { id: entity.wallet_id.id },
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.wallet_id.id,
        operation: "musicianWallet.update",
      });
    }
  }

  async delete(entity_id: Uuid): Promise<void> {
    try {
      await this.client.musicianWallet.delete({
        where: { id: entity_id.id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity_id.id,
        operation: "musicianWallet.delete",
      });
    }
  }

  async findById(entity_id: Uuid): Promise<MusicianWallet | null> {
    const model = await this.client.musicianWallet.findUnique({
      where: { id: entity_id.id },
    });

    return model ? this.mapper.toEntity(model) : null;
  }

  async findAll(): Promise<MusicianWallet[]> {
    const models = await this.client.musicianWallet.findMany();
    return models.map((model) => this.mapper.toEntity(model));
  }

  async findByIds(ids: Uuid[]): Promise<MusicianWallet[]> {
    const models = await this.client.musicianWallet.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((m) => this.mapper.toEntity(m));
  }

  async existsById(
    ids: Uuid[],
  ): Promise<{ exists: Uuid[]; not_exists: Uuid[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.client.musicianWallet.findMany({
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

  async search(
    props: MusicianWalletSearchParams,
  ): Promise<MusicianWalletSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const { where, orderBy } = this.buildSearchQuery(props);

    const [models, count] = await Promise.all([
      this.client.musicianWallet.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.client.musicianWallet.count({ where }),
    ]);

    const entities = models.map((model) => this.mapper.toEntity(model));

    return new MusicianWalletSearchResult({
      items: entities,
      current_page: props.page,
      per_page: props.per_page,
      total: count,
    });
  }

  async findByMusicianId(musicianId: string): Promise<MusicianWallet | null> {
    const model = await this.client.musicianWallet.findUnique({
      where: { musicianId },
    });
    return model ? this.mapper.toEntity(model) : null;
  }

  /**
   * `SELECT ... FOR UPDATE` na linha da carteira, seguido da leitura normal.
   *
   * O `FOR UPDATE` seleciona só a chave: o objetivo é adquirir o lock de linha,
   * e o `findUnique` seguinte — já dentro da mesma transação e do mesmo lock —
   * devolve a entidade pelo mapper de sempre, sem precisar remontar o agregado
   * a partir de colunas cruas.
   */
  async findByMusicianIdForUpdate(
    musicianId: string,
  ): Promise<MusicianWallet | null> {
    const tx = this.uow?.getTransaction();
    if (!tx) {
      throw new InvalidArgumentError(
        "findByMusicianIdForUpdate exige uma transação ativa — fora dela o lock é liberado ao fim do SELECT e não protege nada",
      );
    }

    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "musician_wallets" WHERE "musicianId" = ${musicianId} FOR UPDATE
    `;
    if (locked.length === 0) {
      return null;
    }

    return this.findByMusicianId(musicianId);
  }

  async findByMercadoPagoUserId(
    mpUserId: string,
  ): Promise<MusicianWallet | null> {
    const model = await this.client.musicianWallet.findUnique({
      where: { mpUserId },
    });
    return model ? this.mapper.toEntity(model) : null;
  }

  /**
   * Ordenado pelo vencimento mais próximo: se a fila crescer além do lote,
   * quem está mais perto de expirar é renovado primeiro. O inverso deixaria o
   * token mais urgente para o fim da fila.
   */
  async findMercadoPagoExpiring(
    before: Date,
    limit: number,
  ): Promise<MusicianWallet[]> {
    const models = await this.client.musicianWallet.findMany({
      where: {
        mpUserId: { not: null },
        mpTokenExpiresAt: { lte: before },
      },
      orderBy: { mpTokenExpiresAt: "asc" },
      take: limit,
    });
    return models.map((m) => this.mapper.toEntity(m));
  }

  getEntity(): new (...args: any[]) => MusicianWallet {
    return MusicianWallet;
  }

  private buildSearchQuery(props: MusicianWalletSearchParams) {
    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);
    return { where, orderBy };
  }

  private buildWhereClause(filter: MusicianWalletFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.musician_id) {
      where.musicianId = filter.musician_id;
    }

    if (filter.is_active !== undefined) {
      where.is_active = filter.is_active;
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
}
