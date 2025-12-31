import {
  ITipRepository,
  TipFilter,
  TipOutput,
  TipOutputMapper,
  TipSearchParams,
  TipSearchResult,
} from "@core/payment";
import {
  PaginationOutput,
  PaginationOutputMapper,
} from "@core/shared/application/pagination-output";
import { SearchInput } from "@core/shared/application/search-input";
import { IUseCase } from "@core/shared/application/use-case.interface";

export type GetMusicianTipsInput = SearchInput<TipFilter> & {
  musician_id: string;
};

export type GetMusicianTipsOutput = PaginationOutput<TipOutput>;

export class GetMusicianTipsUseCase implements IUseCase<
  GetMusicianTipsInput,
  GetMusicianTipsOutput
> {
  constructor(private readonly tipRepository: ITipRepository) {}

  async execute(input: GetMusicianTipsInput): Promise<GetMusicianTipsOutput> {
    const searchParams = new TipSearchParams({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        musician_id: input.musician_id,
        ...(input.filter || {}),
      },
    });

    const searchResult = await this.tipRepository.search(searchParams);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: TipSearchResult): GetMusicianTipsOutput {
    const items = searchResult.items.map((tip) => {
      return TipOutputMapper.toOutput(tip);
    });
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}
