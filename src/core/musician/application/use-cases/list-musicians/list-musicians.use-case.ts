import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  IMusicianRepository,
  MusicianSearchParams,
  MusicianSearchResult,
} from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";
import { ListMusiciansInput } from "./list-musicians.input";

export class ListMusiciansUseCase implements IUseCase<
  ListMusiciansInput,
  ListMusiciansOutput
> {
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(input: ListMusiciansInput): Promise<ListMusiciansOutput> {
    const params = MusicianSearchParams.create(input);
    const searchResult = await this.musicianRepo.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: MusicianSearchResult): ListMusiciansOutput {
    const { items: _items } = searchResult;
    const items = _items.map((item) => MusicianOutputMapper.toOutput(item));
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}

export type ListMusiciansOutput = PaginationOutput<MusicianOutput>;
