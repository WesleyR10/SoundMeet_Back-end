import { ApplicationService } from "@core/shared/application/application.service";
import { AggregateRoot } from "@core/shared/domain/aggregate-root";
import { InvariantViolationError } from "@core/shared/domain/errors/invariant-violation.error";
import { DomainEventMediator } from "@core/shared/domain/events/domain-event-mediator";
import { IUnitOfWork } from "@core/shared/domain/repository/unit-of-work.interface";
import { ValueObject } from "@core/shared/domain/value-object";
import { PrismaUnitOfWork } from "@core/shared/infra/db/prisma/prisma-unit-of-work";
import { Prisma } from "@prisma/client";
import EventEmitter2 from "eventemitter2";

class StubAggregateRoot extends AggregateRoot {
  get entity_id(): ValueObject {
    throw new InvariantViolationError("Method not implemented.");
  }

  toJSON() {
    return {};
  }
}

describe("PrismaUnitOfWork", () => {
  it("executa workFn dentro de transação e reseta transaction client", async () => {
    const txClient = {} as Prisma.TransactionClient;
    const prismaMock = {
      $transaction: jest.fn(async (fn: any) => {
        return fn(txClient);
      }),
    } as any;

    const uow = new PrismaUnitOfWork(prismaMock);

    const result = await uow.do(
      async (innerUow: IUnitOfWork<Prisma.TransactionClient>) => {
        expect(innerUow.getTransaction()).toBe(txClient);
        return "ok";
      },
    );

    expect(result).toBe("ok");
    expect(uow.getTransaction()).toBeNull();
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("reaproveita a transação corrente em do() aninhado na mesma cadeia async", async () => {
    const txClient = {} as Prisma.TransactionClient;
    const prismaMock = {
      $transaction: jest.fn(async (fn: any) => fn(txClient)),
    } as any;

    const uow = new PrismaUnitOfWork(prismaMock);

    await uow.do(async () => {
      await uow.do(async () => {
        expect(uow.getTransaction()).toBe(txClient);
      });
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("isola transações concorrentes: nenhuma execução enxerga o tx da outra", async () => {
    // Barreiras determinísticas: A entra na transação e só sai depois que B
    // entrou na sua. É exatamente a janela em que a versão com campo mutável
    // fazia B reusar o tx de A (ou cair no client raiz quando A limpava o campo).
    const txA = { id: "A" } as unknown as Prisma.TransactionClient;
    const txB = { id: "B" } as unknown as Prisma.TransactionClient;

    const clients = [txA, txB];
    const prismaMock = {
      $transaction: jest.fn(async (fn: any) => fn(clients.shift())),
    } as any;

    const uow = new PrismaUnitOfWork(prismaMock);

    let releaseA!: () => void;
    const aMayFinish = new Promise<void>((resolve) => (releaseA = resolve));
    let signalBStarted!: () => void;
    const bStarted = new Promise<void>((resolve) => (signalBStarted = resolve));

    const seen: Record<string, (Prisma.TransactionClient | null)[]> = {
      a: [],
      b: [],
    };

    const runA = uow.do(async () => {
      seen.a.push(uow.getTransaction());
      await bStarted;
      seen.a.push(uow.getTransaction());
      return "a";
    });

    const runB = uow.do(async () => {
      seen.b.push(uow.getTransaction());
      signalBStarted();
      await aMayFinish;
      seen.b.push(uow.getTransaction());
      return "b";
    });

    await bStarted;
    releaseA();

    await expect(Promise.all([runA, runB])).resolves.toEqual(["a", "b"]);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(seen.a).toEqual([txA, txA]);
    expect(seen.b).toEqual([txB, txB]);
    expect(uow.getTransaction()).toBeNull();
  });

  it("mantém aggregate roots separados entre execuções concorrentes", async () => {
    const prismaMock = {
      $transaction: jest.fn(async (fn: any) =>
        fn({} as Prisma.TransactionClient),
      ),
    } as any;

    const uow = new PrismaUnitOfWork(prismaMock);
    const aggregateA = new StubAggregateRoot();
    const aggregateB = new StubAggregateRoot();

    let signalBRegistered!: () => void;
    const bRegistered = new Promise<void>((r) => (signalBRegistered = r));

    const [rootsA, rootsB] = await Promise.all([
      uow.do(async () => {
        uow.addAggregateRoot(aggregateA);
        await bRegistered;
        return uow.getAggregateRoots();
      }),
      uow.do(async () => {
        uow.addAggregateRoot(aggregateB);
        signalBRegistered();
        return uow.getAggregateRoots();
      }),
    ]);

    expect(rootsA).toEqual([aggregateA]);
    expect(rootsB).toEqual([aggregateB]);
  });

  it("propaga rollback de forma independente entre execuções concorrentes", async () => {
    const committed: string[] = [];
    const prismaMock = {
      $transaction: jest.fn(async (fn: any) => {
        const result = await fn({} as Prisma.TransactionClient);
        committed.push(result as string);
        return result;
      }),
    } as any;

    const uow = new PrismaUnitOfWork(prismaMock);

    let signalFailureStarted!: () => void;
    const failureStarted = new Promise<void>((r) => (signalFailureStarted = r));

    const failing = uow.do(async () => {
      signalFailureStarted();
      throw new Error("gorjeta inválida");
    });

    const succeeding = uow.do(async () => {
      await failureStarted;
      return "ok";
    });

    await expect(failing).rejects.toThrow("gorjeta inválida");
    await expect(succeeding).resolves.toBe("ok");
    expect(committed).toEqual(["ok"]);
  });

  it("integra com ApplicationService para orquestrar eventos de domínio", async () => {
    const txClient = {} as Prisma.TransactionClient;
    const prismaMock = {
      $transaction: jest.fn(async (fn: any) => {
        return fn(txClient);
      }),
    } as any;

    const eventEmitter = new EventEmitter2();
    const domainEventMediator = new DomainEventMediator(eventEmitter);
    const uow = new PrismaUnitOfWork(prismaMock);
    const appService = new ApplicationService(uow, domainEventMediator);

    const aggregate = new StubAggregateRoot();
    const publishSpy = jest.spyOn(domainEventMediator, "publish");
    const publishIntegrationSpy = jest.spyOn(
      domainEventMediator,
      "publishIntegrationEvents",
    );

    await appService.run(async () => {
      uow.addAggregateRoot(aggregate);
      return "result";
    });

    expect(publishSpy).toHaveBeenCalledWith(aggregate);
    expect(publishIntegrationSpy).toHaveBeenCalledWith(aggregate);
  });
});
