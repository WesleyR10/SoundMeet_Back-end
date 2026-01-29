import { AggregateRoot } from "../aggregate-root";

export interface IUnitOfWork<TTransaction = any> {
  start(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  getTransaction(): TTransaction | null;
  do<T>(workFn: (uow: IUnitOfWork<TTransaction>) => Promise<T>): Promise<T>;
  addAggregateRoot(aggregateRoot: AggregateRoot): void;
  getAggregateRoots(): AggregateRoot[];
}
