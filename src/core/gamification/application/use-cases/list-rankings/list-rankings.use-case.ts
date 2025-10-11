import { IUseCase } from "../../../../shared/application/use-case.interface";
import { RankingOutput, RankingOutputMapper } from "../common/ranking-output";

import { ListRankingsInput } from "./list-rankings.input";
import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import {
  IRankingRepository,
  RankingSearchParams,
  RankingSearchResult,
} from "@core/gamification/domain";

export type ListRankingsOutput = PaginationOutput<RankingOutput>;

export class ListRankingsUseCase
  implements IUseCase<ListRankingsInput, ListRankingsOutput>
{
  constructor(private rankingRepository: IRankingRepository) {}

  async execute(input: ListRankingsInput): Promise<ListRankingsOutput> {
    const params = RankingSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: input.filter,
    });

    const searchResult = await this.rankingRepository.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: RankingSearchResult): ListRankingsOutput {
    const { items: _items } = searchResult;
    const items = _items.map((i) => {
      return RankingOutputMapper.toOutput(i);
    });
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}
