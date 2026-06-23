import {
  ITransactionRepository,
  TransactionOutput,
  TransactionOutputMapper,
  TransactionSearchParams,
} from "@core/payment";
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
    const items = result.items.map((t) => TransactionOutputMapper.toOutput(t));
    return PaginationOutputMapper.toOutput(items, result);
  }
}
