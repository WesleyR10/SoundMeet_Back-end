import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import {
  MusicianFilter,
  MusicianSearchParams,
  IMusicianRepository,
} from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-output";

export class ListMusiciansUseCase
  implements IUseCase<ListMusiciansInput, ListMusiciansOutput>
{
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(input: ListMusiciansInput): Promise<ListMusiciansOutput> {
    const params = MusicianSearchParams.create(input);
    const searchResult = await this.musicianRepo.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: any): ListMusiciansOutput {
    const { items: _items } = searchResult;
    const items = _items.map((i) => {
      return MusicianOutputMapper.toOutput(i);
    });
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}

export type ListMusiciansInput = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: MusicianFilter | null;
};

export type ListMusiciansOutput = PaginationOutput<MusicianOutput>;
