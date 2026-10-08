import { Prisma, PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";

import { AggregateRoot } from "../../../domain/aggregate-root";
import { IUnitOfWork } from "../../../domain/repository/unit-of-work.interface";

type UnitOfWorkContext = {
  transactionClient: Prisma.TransactionClient;
  aggregateRoots: Set<AggregateRoot>;
};

/**
 * O estado transacional vive no AsyncLocalStorage, NUNCA em campo de instância.
 *
 * A UoW é instanciada uma vez por provider (singleton do Nest) e compartilhada
 * por todas as requisições. Guardar `transactionClient` como propriedade fazia
 * duas execuções concorrentes colidirem: a segunda enxergava a transação da
 * primeira e escrevia dentro dela, e quando o `finally` da primeira limpava o
 * campo a segunda passava a escrever fora de qualquer transação. Em confirmação
 * de gorjeta isso significa commit/rollback cruzado e saldo corrompido.
 *
 * Com ALS cada cadeia async carrega o próprio store: `do()` aninhado dentro da
 * mesma cadeia reaproveita a transação corrente (reentrância legítima), e
 * cadeias distintas ficam invisíveis uma para a outra.
 */
export class PrismaUnitOfWork implements IUnitOfWork<Prisma.TransactionClient> {
  private readonly storage = new AsyncLocalStorage<UnitOfWorkContext>();

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
    return this.storage.getStore()?.transactionClient ?? null;
  }

  async do<T>(
    workFn: (uow: IUnitOfWork<Prisma.TransactionClient>) => Promise<T>,
  ): Promise<T> {
    if (this.storage.getStore()) {
      return workFn(this);
    }

    return this.prisma.$transaction((tx) =>
      this.storage.run(
        { transactionClient: tx, aggregateRoots: new Set<AggregateRoot>() },
        () => workFn(this),
      ),
    );
  }

  addAggregateRoot(aggregateRoot: AggregateRoot): void {
    const store = this.storage.getStore();
    if (!store) {
      return;
    }
    store.aggregateRoots.add(aggregateRoot);
  }

  getAggregateRoots(): AggregateRoot[] {
    return [...(this.storage.getStore()?.aggregateRoots ?? [])];
  }
}
