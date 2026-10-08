import { Prisma, PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { IUnitOfWork } from "../../../../shared/domain/repository/unit-of-work.interface";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { Contract, ContractId } from "../../../domain/contract.aggregate";
import {
  ContractFilter,
  ContractSearchParams,
  ContractSearchResult,
  IContractRepository,
} from "../../../domain/contract.repository";
import { ContractModel, ContractModelMapper } from "./contract-model.mapper";

export class ContractPrismaRepository implements IContractRepository {
  sortableFields: string[] = ["created_at", "issued_at", "signed_at"];

  constructor(
    private prisma: PrismaClient,
    private readonly uow?: IUnitOfWork<Prisma.TransactionClient>,
  ) {}

  /**
   * O cliente da transação corrente, quando houver.
   *
   * Mesmo padrão de todo repositório Prisma do projeto: a UoW guarda o estado
   * transacional em `AsyncLocalStorage`, e ler daqui é o que faz o repositório
   * participar da transação sem que o use case precise passar o client adiante.
   */
  private get client(): PrismaClient | Prisma.TransactionClient {
    return (
      (this.uow?.getTransaction() as Prisma.TransactionClient) ?? this.prisma
    );
  }

  async insert(entity: Contract): Promise<void> {
    try {
      await this.client.contract.create({
        data: ContractModelMapper.toModel(entity) as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.contract_id.id,
        operation: "contract.create",
      });
    }
  }

  async bulkInsert(entities: Contract[]): Promise<void> {
    try {
      await this.client.contract.createMany({
        data: entities.map((entity) =>
          ContractModelMapper.toModel(entity),
        ) as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: "bulk",
        operation: "contract.bulkInsert",
      });
    }
  }

  /**
   * ⚠️ Só `status`, assinaturas, certificado e anulação mudam depois da
   * emissão. O `data` inteiro é enviado por simetria com os demais
   * repositórios, mas o conteúdo congelado não tem mutador no agregado — não há
   * caminho pelo qual um `update` reescreva cláusula, variável ou parte.
   */
  async update(entity: Contract): Promise<void> {
    const model = ContractModelMapper.toModel(entity);
    try {
      await this.client.contract.update({
        where: { id: model.id },
        data: model as any,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.contract_id.id,
        operation: "contract.update",
      });
    }
  }

  async delete(id: ContractId): Promise<void> {
    try {
      await this.client.contract.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "contract.delete",
      });
    }
  }

  async findById(id: ContractId): Promise<Contract | null> {
    const model = await this.client.contract.findUnique({
      where: { id: id.id },
    });
    return model
      ? ContractModelMapper.toEntity(model as unknown as ContractModel)
      : null;
  }

  async findByIds(ids: ContractId[]): Promise<Contract[]> {
    const models = await this.client.contract.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
    });
    return models.map((m) =>
      ContractModelMapper.toEntity(m as unknown as ContractModel),
    );
  }

  async findAll(): Promise<Contract[]> {
    const models = await this.client.contract.findMany();
    return models.map((m) =>
      ContractModelMapper.toEntity(m as unknown as ContractModel),
    );
  }

  async existsById(
    ids: ContractId[],
  ): Promise<{ exists: ContractId[]; not_exists: ContractId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existing = await this.client.contract.findMany({
      where: { id: { in: ids.map((i) => i.id) } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e) => e.id));

    return {
      exists: ids.filter((i) => existingIds.has(i.id)),
      not_exists: ids.filter((i) => !existingIds.has(i.id)),
    };
  }

  /**
   * Contrato vigente do booking: maior revisão que não esteja anulada.
   *
   * Anulado não conta — é justamente o estado que libera a emissão de um
   * contrato novo para o mesmo booking.
   */
  async findCurrentByBookingId(booking_id: string): Promise<Contract | null> {
    const model = await this.client.contract.findFirst({
      where: { bookingId: booking_id, status: { not: "annulled" } },
      orderBy: { revision: "desc" },
    });
    return model
      ? ContractModelMapper.toEntity(model as unknown as ContractModel)
      : null;
  }

  async findByVerificationCode(code: string): Promise<Contract | null> {
    const model = await this.client.contract.findUnique({
      where: { verification_code: code },
    });
    return model
      ? ContractModelMapper.toEntity(model as unknown as ContractModel)
      : null;
  }

  async search(props: ContractSearchParams): Promise<ContractSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const where = this.buildWhereClause(props.filter);

    const [models, total] = await Promise.all([
      this.client.contract.findMany({
        where,
        orderBy: this.buildOrderByClause(props.sort, props.sort_dir),
        skip: offset,
        take: props.per_page,
      }),
      this.client.contract.count({ where }),
    ]);

    return new ContractSearchResult({
      items: models.map((m) =>
        ContractModelMapper.toEntity(m as unknown as ContractModel),
      ),
      total,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  private buildWhereClause(filter?: ContractFilter | null) {
    if (!filter) return {};

    const where: any = {};

    if (filter.booking_id) where.bookingId = filter.booking_id;
    if (filter.establishment_id)
      where.establishmentId = filter.establishment_id;
    if (filter.musician_id) where.musicianId = filter.musician_id;
    if (filter.band_id) where.bandId = filter.band_id;
    if (filter.status) where.status = `${filter.status}`;

    /*
     * 🔴 Escopo do ator. As identidades casam em OR contra os três lados
     * possíveis, porque o lado pelo qual a pessoa participa depende do papel.
     *
     * Array VAZIO produz `OR: []`, que no Prisma não casa com nada — e é
     * exatamente o comportamento correto: ator sem identidade utilizável vê
     * zero contratos. Transformar lista vazia em "sem filtro" entregaria os
     * contratos de todos os usuários, que é o vazamento já ocorrido em
     * `repertoire`, `transaction` e `musician-wallet`.
     */
    if (filter.participant_ids) {
      const ids = filter.participant_ids;
      where.OR = [
        { establishmentId: { in: ids } },
        { musicianId: { in: ids } },
        { bandId: { in: ids } },
      ];
    }

    return where;
  }

  private buildOrderByClause(
    sort: string | null,
    sort_dir: string | null,
  ): any {
    if (!sort || !this.sortableFields.includes(sort)) {
      return { created_at: "desc" };
    }
    return { [sort]: sort_dir === "asc" ? "asc" : "desc" };
  }

  getEntity(): new (...args: any[]) => Contract {
    return Contract;
  }
}
