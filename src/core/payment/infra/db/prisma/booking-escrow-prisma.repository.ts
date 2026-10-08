import { Prisma, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { IUnitOfWork } from "../../../../shared/domain/repository/unit-of-work.interface";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  BookingEscrow,
  BookingEscrowId,
} from "../../../domain/booking-escrow.aggregate";
import { BookingEscrowStatus } from "../../../domain/booking-escrow-enums";
import {
  BookingEscrowFilter,
  BookingEscrowSearchParams,
  BookingEscrowSearchResult,
  IBookingEscrowRepository,
} from "../../../domain/repositories/booking-escrow.repository";
import { BookingEscrowModelMapper } from "./booking-escrow-model.mapper";

/**
 * Nomes de ordenação do DOMÍNIO → colunas do Prisma.
 *
 * A tabela mistura convenções (`created_at` snake, `releasedAt` camel), e o
 * in-memory ordena pelos campos do agregado — todos snake. Sem esta tradução,
 * `?sort=released_at` funcionaria nos testes e seria **silenciosamente
 * ignorado** em produção, caindo no default: o cliente pediria uma ordem e
 * receberia outra, sem erro.
 */
const SORT_COLUMN: Record<string, string> = {
  created_at: "created_at",
  amount: "amount",
  released_at: "releasedAt",
  held_at: "heldAt",
};

export class BookingEscrowPrismaRepository implements IBookingEscrowRepository {
  sortableFields: string[] = Object.keys(SORT_COLUMN);

  constructor(
    private prisma: PrismaClient,
    private readonly uow?: IUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private get client(): PrismaClient | Prisma.TransactionClient {
    return this.uow?.getTransaction() ?? this.prisma;
  }

  async insert(entity: BookingEscrow): Promise<void> {
    try {
      await this.client.bookingEscrow.create({
        data: BookingEscrowModelMapper.toModel(entity),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.escrow_id.id,
        operation: "bookingEscrow.create",
      });
    }
  }

  async bulkInsert(entities: BookingEscrow[]): Promise<void> {
    try {
      await this.client.bookingEscrow.createMany({
        data: entities.map((e) => BookingEscrowModelMapper.toModel(e)),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "bookingEscrow.createMany",
      });
    }
  }

  async update(entity: BookingEscrow): Promise<void> {
    try {
      await this.client.bookingEscrow.update({
        where: { id: entity.escrow_id.id },
        data: BookingEscrowModelMapper.toModel(entity),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.escrow_id.id,
        operation: "bookingEscrow.update",
      });
    }
  }

  async delete(entity_id: BookingEscrowId): Promise<void> {
    try {
      await this.client.bookingEscrow.delete({ where: { id: entity_id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity_id.id,
        operation: "bookingEscrow.delete",
      });
    }
  }

  async findById(entity_id: BookingEscrowId): Promise<BookingEscrow | null> {
    const model = await this.client.bookingEscrow.findUnique({
      where: { id: entity_id.id },
    });
    return model ? BookingEscrowModelMapper.toEntity(model) : null;
  }

  async findAll(): Promise<BookingEscrow[]> {
    const models = await this.client.bookingEscrow.findMany();
    return models.map((m) => BookingEscrowModelMapper.toEntity(m));
  }

  async findByIds(ids: BookingEscrowId[]): Promise<BookingEscrow[]> {
    const models = await this.client.bookingEscrow.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
    });
    return models.map((m) => BookingEscrowModelMapper.toEntity(m));
  }

  async existsById(
    ids: BookingEscrowId[],
  ): Promise<{ exists: BookingEscrowId[]; not_exists: BookingEscrowId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existing = await this.client.bookingEscrow.findMany({
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
    props: BookingEscrowSearchParams,
  ): Promise<BookingEscrowSearchResult> {
    const where = this.buildWhereClause(props.filter);
    const orderBy = this.buildOrderByClause(props.sort, props.sort_dir);

    const [models, count] = await Promise.all([
      this.client.bookingEscrow.findMany({
        where,
        orderBy,
        skip: (props.page - 1) * props.per_page,
        take: props.per_page,
      }),
      this.client.bookingEscrow.count({ where }),
    ]);

    return new BookingEscrowSearchResult({
      items: models.map((m) => BookingEscrowModelMapper.toEntity(m)),
      current_page: props.page,
      per_page: props.per_page,
      total: count,
    });
  }

  async findByBookingId(bookingId: string): Promise<BookingEscrow | null> {
    const model = await this.client.bookingEscrow.findUnique({
      where: { bookingId },
    });
    return model ? BookingEscrowModelMapper.toEntity(model) : null;
  }

  async findByExternalId(externalId: string): Promise<BookingEscrow | null> {
    const model = await this.client.bookingEscrow.findUnique({
      where: { externalId },
    });
    return model ? BookingEscrowModelMapper.toEntity(model) : null;
  }

  /**
   * A varredura do `EscrowReleaseJob`.
   *
   * Só `held`: `disputed` espera mediação humana, e liberar automaticamente uma
   * contestação em aberto seria decidir a disputa a favor de um lado por
   * omissão. `heldAt` ordenado crescente para a custódia mais antiga sair
   * primeiro — se a fila crescer, quem espera há mais tempo é atendido antes.
   */
  async findReleasable(before: Date, limit: number): Promise<BookingEscrow[]> {
    const models = await this.client.bookingEscrow.findMany({
      where: {
        status: BookingEscrowStatus.HELD as any,
        heldAt: { lte: before },
      },
      orderBy: { heldAt: "asc" },
      take: limit,
    });
    return models.map((m) => BookingEscrowModelMapper.toEntity(m));
  }

  getEntity(): new (...args: any[]) => BookingEscrow {
    return BookingEscrow;
  }

  private buildWhereClause(filter: BookingEscrowFilter | null) {
    if (!filter) return {};

    const where: any = {};
    if (filter.musician_id) where.musicianId = filter.musician_id;
    if (filter.booking_id) where.bookingId = filter.booking_id;
    if (filter.status) where.status = filter.status;
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
