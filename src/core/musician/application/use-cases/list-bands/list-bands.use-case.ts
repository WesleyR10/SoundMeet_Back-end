import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  BandSearchParams,
  BandSearchResult,
  IBandRepository,
} from "../../../domain/band.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { ListBandsInput } from "./list-bands.input";

export type ListBandsOutput = PaginationOutput<BandOutput>;

export class ListBandsUseCase implements IUseCase<
  ListBandsInput,
  ListBandsOutput
> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: ListBandsInput): Promise<ListBandsOutput> {
    const params = BandSearchParams.create(input);
    const searchResult = await this.bandRepo.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: BandSearchResult): ListBandsOutput {
    const { items: _items } = searchResult;
    const items = _items.map((item) => BandOutputMapper.toOutput(item));
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}
