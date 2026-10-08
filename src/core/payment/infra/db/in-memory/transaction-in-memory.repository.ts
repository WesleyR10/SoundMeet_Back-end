import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  ITransactionRepository,
  TransactionFilter,
  TransactionSearchParams,
  TransactionSearchResult,
} from "../../../domain/repositories/transaction.repository";
import { Transaction } from "../../../domain/transaction.aggregate";
import {
  TransactionStatus,
  TransactionType,
} from "../../../domain/transaction-enums";

export class TransactionInMemoryRepository
  extends InMemorySearchableRepository<Transaction, Uuid, TransactionFilter>
  implements ITransactionRepository
{
  sortableFields: string[] = ["created_at", "amount"];

  async search(
    props: TransactionSearchParams,
  ): Promise<TransactionSearchResult> {
    const result = await super.search(props);
    return new TransactionSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  getEntity(): new (...args: any[]) => Transaction {
    return Transaction;
  }

  protected async applyFilter(
    items: Transaction[],
    filter: TransactionFilter | null,
  ): Promise<Transaction[]> {
    if (!filter) {
      return items;
    }

    return items.filter((item) => {
      if (filter.user_id && item.user_id?.id !== filter.user_id) {
        return false;
      }
      if (filter.musician_id && item.musician_id?.id !== filter.musician_id) {
        return false;
      }
      if (filter.type && item.type !== filter.type) {
        return false;
      }
      if (filter.status && item.status !== filter.status) {
        return false;
      }
      if (filter.start_date && item.created_at < filter.start_date) {
        return false;
      }
      if (filter.end_date && item.created_at > filter.end_date) {
        return false;
      }
      return true;
    });
  }

  protected applySort(
    items: Transaction[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }

  async findByMusicianId(musicianId: string): Promise<Transaction[]> {
    return this.items.filter((item) => item.musician_id?.id === musicianId);
  }

  async findByUserId(userId: string): Promise<Transaction[]> {
    return this.items.filter((item) => item.user_id?.id === userId);
  }

  async findByExternalId(externalId: string): Promise<Transaction | null> {
    return this.items.find((item) => item.external_id === externalId) ?? null;
  }

  async findByIdempotencyKey(
    key: string,
    musicianId: string,
  ): Promise<Transaction | null> {
    // O escopo de dono é parte do contrato, não detalhe do Prisma — sem ele
    // aqui, o teste unitário passaria e o defeito só apareceria em produção.
    return (
      this.items.find(
        (item) =>
          item.idempotency_key === key &&
          item.musician_id?.id === musicianId,
      ) ?? null
    );
  }

  async sumWithdrawalsSince(
    musicianId: string,
    since: Date,
  ): Promise<{ total: number; count: number }> {
    const counted = this.items.filter(
      (item) =>
        item.musician_id?.id === musicianId &&
        item.type === TransactionType.WITHDRAWAL &&
        (item.status === TransactionStatus.PENDING ||
          item.status === TransactionStatus.COMPLETED) &&
        item.created_at >= since,
    );
    const total = counted.reduce((sum, item) => sum + item.amount.amount, 0);
    return { total, count: counted.length };
  }
}
