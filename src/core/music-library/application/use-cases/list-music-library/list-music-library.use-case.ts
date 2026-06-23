import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  IMusicLibraryRepository,
  MusicLibrarySearchParams,
  MusicLibrarySearchResult,
} from "../../../domain/music-library.repository";
import {
  MusicLibraryOutput,
  MusicLibraryOutputMapper,
} from "../common/music-library-output";
import { ListMusicLibraryInput } from "./list-music-library.input";

export class ListMusicLibraryUseCase implements IUseCase<
  ListMusicLibraryInput,
  ListMusicLibraryOutput
> {
  constructor(private readonly musicLibraryRepo: IMusicLibraryRepository) {}

  async execute(input: ListMusicLibraryInput): Promise<ListMusicLibraryOutput> {
    const params = MusicLibrarySearchParams.create(input);
    const searchResult = await this.musicLibraryRepo.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(
    searchResult: MusicLibrarySearchResult,
  ): ListMusicLibraryOutput {
    const { items: _items } = searchResult;
    const items = _items.map((item) => MusicLibraryOutputMapper.toOutput(item));
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}

export type ListMusicLibraryOutput = PaginationOutput<MusicLibraryOutput>;
