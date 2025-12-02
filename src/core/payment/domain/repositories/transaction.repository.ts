import { ISearchableRepository } from "../../../shared/domain/repository/repository-interface";
import { SearchParams } from "../../../shared/domain/repository/search-params";
import { SearchResult } from "../../../shared/domain/repository/search-result";
import { Transaction } from "../transaction.entity";
import { TransactionStatus, TransactionType } from "../transaction-enums";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";

export type TransactionFilter = {
  user_id?: string;
  musician_id?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  start_date?: Date;
  end_date?: Date;
};

export class TransactionSearchParams extends SearchParams<TransactionFilter> {}

export class TransactionSearchResult extends SearchResult<Transaction> {}

export interface ITransactionRepository
  extends ISearchableRepository<
    Transaction,
    Uuid,
    TransactionFilter,
    TransactionSearchParams,
    TransactionSearchResult
  > {
  findByMusicianId(musicianId: string): Promise<Transaction[]>;
  findByUserId(userId: string): Promise<Transaction[]>;
}
