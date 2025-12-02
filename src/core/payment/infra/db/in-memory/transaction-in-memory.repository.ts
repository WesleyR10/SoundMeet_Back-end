import {
  ITransactionRepository,
  TransactionFilter,
  TransactionSearchParams,
  TransactionSearchResult,
} from "../../../domain/repositories/transaction.repository";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Transaction } from "../../../domain/transaction.entity";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { SortDirection } from "../../../../shared/domain/repository/search-params";

export class TransactionInMemoryRepository
  extends InMemorySearchableRepository<
    Transaction,
    Uuid,
    TransactionFilter
  >
  implements ITransactionRepository
{
  sortableFields: string[] = ["created_at", "amount"];

  async search(
    props: TransactionSearchParams
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
    filter: TransactionFilter | null
  ): Promise<Transaction[]> {
    if (!filter) {
      return items;
    }

    return items.filter((item) => {
      if (
        filter.user_id &&
        item.user_id?.id !== filter.user_id
      ) {
        return false;
      }
      if (
        filter.musician_id &&
        item.musician_id?.id !== filter.musician_id
      ) {
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
    sort_dir: SortDirection | null
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
}
