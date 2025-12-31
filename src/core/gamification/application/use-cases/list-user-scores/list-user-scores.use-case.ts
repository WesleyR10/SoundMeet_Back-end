import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IUserScoreRepository } from "../../../domain/user-score.repository";
import {
  UserScoreSearchParams,
  UserScoreSearchResult,
} from "../../../domain/user-score.repository";
import {
  UserScoreOutput,
  UserScoreOutputMapper,
} from "../common/user-score-output";
import { ListUserScoresInput } from "./list-user-scores.input";

export type ListUserScoresOutput = PaginationOutput<UserScoreOutput>;

export class ListUserScoresUseCase implements IUseCase<
  ListUserScoresInput,
  ListUserScoresOutput
> {
  constructor(private userScoreRepository: IUserScoreRepository) {}

  async execute(input: ListUserScoresInput): Promise<ListUserScoresOutput> {
    const params = UserScoreSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: input.filter,
    });

    const searchResult = await this.userScoreRepository.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: UserScoreSearchResult): ListUserScoresOutput {
    const { items: _items } = searchResult;
    const items = _items.map((i) => {
      return UserScoreOutputMapper.toOutput(i);
    });
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}
