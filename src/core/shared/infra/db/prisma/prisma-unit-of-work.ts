import { Prisma, PrismaClient } from "@prisma/client";

import { AggregateRoot } from "../../../domain/aggregate-root";
import { IUnitOfWork } from "../../../domain/repository/unit-of-work.interface";

export class PrismaUnitOfWork implements IUnitOfWork<Prisma.TransactionClient> {
  private transactionClient: Prisma.TransactionClient | null = null;
  private aggregateRoots: Set<AggregateRoot> = new Set<AggregateRoot>();

  constructor(private readonly prisma: PrismaClient) {}

  async start(): Promise<void> {
    return;
  }

  async commit(): Promise<void> {
    return;
  }

  async rollback(): Promise<void> {
    return;
  }

  getTransaction(): Prisma.TransactionClient | null {
    return this.transactionClient;
  }

  async do<T>(
    workFn: (uow: IUnitOfWork<Prisma.TransactionClient>) => Promise<T>,
  ): Promise<T> {
    if (this.transactionClient) {
      return workFn(this);
    }

    this.aggregateRoots.clear();

    return this.prisma.$transaction(async (tx) => {
      this.transactionClient = tx;
      try {
        const result = await workFn(this);
        return result;
      } finally {
        this.transactionClient = null;
      }
    });
  }

  addAggregateRoot(aggregateRoot: AggregateRoot): void {
    this.aggregateRoots.add(aggregateRoot);
  }

  getAggregateRoots(): AggregateRoot[] {
    return [...this.aggregateRoots];
  }
}
