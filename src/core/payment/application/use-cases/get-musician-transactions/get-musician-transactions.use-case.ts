import { Transaction } from "@core/payment";
import {
  ITransactionRepository,
  TransactionSearchParams,
} from "@core/payment/domain/repositories";
import {
  TransactionStatus,
  TransactionType,
} from "@core/payment/domain/transaction-enums";
import {
  PaginationOutput,
  PaginationOutputMapper,
} from "@core/shared/application/pagination-output";
import { SearchInput } from "@core/shared/application/search-input";
import { IUseCase } from "@core/shared/application/use-case.interface";

export type GetMusicianTransactionsInput = SearchInput<{
  status?: string;
  type?: string;
}> & {
  musician_id: string;
};

export type TransactionOutput = {
  id: string;
  type: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  payment_method: string;
  created_at: Date;
};

export type GetMusicianTransactionsOutput = PaginationOutput<TransactionOutput>;

export class GetMusicianTransactionsUseCase implements IUseCase<
  GetMusicianTransactionsInput,
  GetMusicianTransactionsOutput
> {
  constructor(private readonly txRepo: ITransactionRepository) {}

  async execute(
    input: GetMusicianTransactionsInput,
  ): Promise<GetMusicianTransactionsOutput> {
    const params = new TransactionSearchParams({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        musician_id: input.musician_id,
        status: input.filter?.status as TransactionStatus,
        type: input.filter?.type as TransactionType,
      },
    });

    const result = await this.txRepo.search(params);
    const items = result.items.map((t: Transaction) => ({
      id: t.transaction_id.id,
      type: t.type,
      amount: t.amount.amount,
      fee: t.fee.amount,
      net_amount: t.net_amount.amount,
      status: t.status,
      payment_method: t.payment_method,
      created_at: t.created_at,
    }));
    return PaginationOutputMapper.toOutput(items, result);
  }
}
