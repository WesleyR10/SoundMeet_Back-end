import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  BadgeSearchParams,
  IBadgeRepository,
} from "../../../domain/badge.repository";
import { BadgeOutput, BadgeOutputMapper } from "../common/badge-output";
import { ListBadgesInput } from "./list-badges.input";

export class ListBadgesUseCase implements IUseCase<
  ListBadgesInput,
  ListBadgesOutput
> {
  constructor(private readonly badgeRepo: IBadgeRepository) {}

  async execute(input: ListBadgesInput): Promise<ListBadgesOutput> {
    const params = BadgeSearchParams.create(input);
    const searchResult = await this.badgeRepo.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: any): ListBadgesOutput {
    const { items: _items } = searchResult;
    const items = _items.map((i) => {
      return BadgeOutputMapper.toOutput(i);
    });
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}

export type ListBadgesOutput = PaginationOutput<BadgeOutput>;
