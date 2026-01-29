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
