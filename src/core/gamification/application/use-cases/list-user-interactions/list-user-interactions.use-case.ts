import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import {
  IUserInteractionRepository,
  UserInteractionFilter,
  UserInteractionSearchParams,
} from "../../../domain/user-interaction.repository";
import {
  UserInteractionOutput,
  UserInteractionOutputMapper,
} from "../common/user-interaction-output";

export class ListUserInteractionsUseCase implements IUseCase<
  ListUserInteractionsInput,
  ListUserInteractionsOutput
> {
  constructor(
    private readonly userInteractionRepo: IUserInteractionRepository,
  ) {}

  async execute(
    input: ListUserInteractionsInput,
  ): Promise<ListUserInteractionsOutput> {
    const params = UserInteractionSearchParams.create(input);
    const searchResult = await this.userInteractionRepo.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: any): ListUserInteractionsOutput {
    const { items: _items } = searchResult;
    const items = _items.map((i) => {
      return UserInteractionOutputMapper.toOutput(i);
    });
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}

export type ListUserInteractionsInput = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: UserInteractionFilter | null;
};

export type ListUserInteractionsOutput =
  PaginationOutput<UserInteractionOutput>;
