import { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { MusicianWallet } from "../../../domain/musician-wallet.entity";
import {
  IMusicianWalletRepository,
  MusicianWalletFilter,
  MusicianWalletSearchParams,
  MusicianWalletSearchResult,
} from "../../../domain/repositories/musician-wallet.repository";
import { MusicianWalletModelMapper } from "./musician-wallet-model.mapper";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";

export class MusicianWalletPrismaRepository implements IMusicianWalletRepository {
  sortableFields: string[] = ["created_at", "balance", "totalEarned"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: MusicianWallet): Promise<void> {
    const modelProps = MusicianWalletModelMapper.toModel(entity);
    await this.prisma.musicianWallet.create({
      data: modelProps,
    });
  }

  async bulkInsert(entities: MusicianWallet[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      MusicianWalletModelMapper.toModel(entity)
    );
    await this.prisma.musicianWallet.createMany({
      data: modelsProps,
    });
  }

  async update(entity: MusicianWallet): Promise<void> {
    const modelProps = MusicianWalletModelMapper.toModel(entity);
    try {
      await this.prisma.musicianWallet.update({
        where: { id: entity.wallet_id.id },
        data: modelProps,
      });
    } catch (e) {
      throw new NotFoundError(entity.wallet_id.id, MusicianWallet);
    }
  }

  async delete(entity_id: Uuid): Promise<void> {
    try {
      await this.prisma.musicianWallet.delete({
        where: { id: entity_id.id },
      });
    } catch (e) {
      throw new NotFoundError(entity_id.id, MusicianWallet);
    }
  }

  async findById(entity_id: Uuid): Promise<MusicianWallet | null> {
    const model = await this.prisma.musicianWallet.findUnique({
      where: { id: entity_id.id },
    });

    return model ? MusicianWalletModelMapper.toEntity(model) : null;
  }

  async findAll(): Promise<MusicianWallet[]> {
    const models = await this.prisma.musicianWallet.findMany();
    return models.map((model) => MusicianWalletModelMapper.toEntity(model));
  }

  async findByIds(ids: Uuid[]): Promise<MusicianWallet[]> {
    const models = await this.prisma.musicianWallet.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map((m) => MusicianWalletModelMapper.toEntity(m));
  }

  async existsById(
    ids: Uuid[]
  ): Promise<{ exists: Uuid[]; not_exists: Uuid[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element"
      );
    }

    const existingModels = await this.prisma.musicianWallet.findMany({
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
    props: MusicianWalletSearchParams
  ): Promise<MusicianWalletSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const { where, orderBy } = this.buildSearchQuery(props);

    const [models, count] = await Promise.all([
      this.prisma.musicianWallet.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.musicianWallet.count({ where }),
    ]);

    const entities = models.map((model) =>
      MusicianWalletModelMapper.toEntity(model)
    );

    return new MusicianWalletSearchResult({
      items: entities,
      current_page: props.page,
      per_page: props.per_page,
      total: count,
    });
  }

  async findByMusicianId(musicianId: string): Promise<MusicianWallet | null> {
    const model = await this.prisma.musicianWallet.findUnique({
      where: { musicianId },
    });
    return model ? MusicianWalletModelMapper.toEntity(model) : null;
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
    sort_dir: "asc" | "desc" | null
  ) {
    if (sort && this.sortableFields.includes(sort)) {
      return { [sort]: sort_dir || "asc" };
    }
    return { created_at: sort_dir || "asc" };
  }
}
