import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import {
  IUserPointsRepository,
  UserPointsFilter,
  UserPointsSearchParams,
} from "../../../domain/user-points.repository";
import {
  UserPointsOutput,
  UserPointsOutputMapper,
} from "../common/user-points-output";

export class ListUserPointsUseCase implements IUseCase<
  ListUserPointsInput,
  ListUserPointsOutput
> {
  constructor(private readonly userPointsRepo: IUserPointsRepository) {}

  async execute(input: ListUserPointsInput): Promise<ListUserPointsOutput> {
    const params = UserPointsSearchParams.create(input);
    const searchResult = await this.userPointsRepo.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: any): ListUserPointsOutput {
    const { items: _items } = searchResult;
    const items = _items.map((i) => {
      return UserPointsOutputMapper.toOutput(i);
    });
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}

export type ListUserPointsInput = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: UserPointsFilter | null;
};

export type ListUserPointsOutput = PaginationOutput<UserPointsOutput>;
