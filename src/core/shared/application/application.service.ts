import { DomainEventMediator } from "../domain/events/domain-event-mediator";
import { IUnitOfWork } from "../domain/repository/unit-of-work.interface";

export class ApplicationService {
  constructor(
    private uow: IUnitOfWork,
    private domainEventMediator: DomainEventMediator,
  ) {}

  async start() {
    await this.uow.start();
  }

  async finish() {
    const aggregateRoots = [...this.uow.getAggregateRoots()];
    for (const aggregateRoot of aggregateRoots) {
      await this.domainEventMediator.publish(aggregateRoot);
    }

    await this.uow.commit();

    for (const aggregateRoot of aggregateRoots) {
      await this.domainEventMediator.publishIntegrationEvents(aggregateRoot);
    }
  }

  async fail() {
    this.uow.rollback();
  }

  // Todo o fluxo roda dentro de `uow.do()` para que start/callback/finish
  // compartilhem o mesmo escopo transacional. A UoW do Prisma guarda transação
  // e aggregate roots em AsyncLocalStorage: fora do `do()` não existe store, e
  // `finish()` não enxergaria os agregados registrados pelo callback.
  async run<T>(callback: () => Promise<T>): Promise<T> {
    return this.uow.do(async () => {
      await this.start();
      try {
        const result = await callback();
        await this.finish();
        return result;
      } catch (error) {
        await this.fail();
        throw error;
      }
    });
  }
}
