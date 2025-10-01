import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IAudienceRepository } from "../../../domain/audience.repository";
import { AudienceSearchParams } from "../../../domain/audience.repository";
import { AudienceSearchResult } from "../../../domain/audience.repository";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { ListAudiencesInput } from "./list-audiences.input";

export class ListAudiencesUseCase
  implements IUseCase<ListAudiencesInput, ListAudiencesOutput>
{
  constructor(private readonly audienceRepo: IAudienceRepository) {}

  async execute(input: ListAudiencesInput): Promise<ListAudiencesOutput> {
    const params = AudienceSearchParams.create(input);
    const searchResult = await this.audienceRepo.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: AudienceSearchResult): ListAudiencesOutput {
    const { items: _items, ...otherProps } = searchResult;
    const items = _items.map((item) => AudienceOutputMapper.toOutput(item));

    return PaginationOutputMapper.toOutput(items, otherProps);
  }
}

export type ListAudiencesOutput = PaginationOutput<AudienceOutput>;
