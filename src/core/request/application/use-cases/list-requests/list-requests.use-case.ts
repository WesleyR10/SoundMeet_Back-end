import {
  IRequestRepository,
  RequestFilter,
  RequestSearchParams,
} from "../../../domain/request.repository";
import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ListRequestsInput } from "./list-requests.input";

export type ListRequestsOutput = PaginationOutput<RequestOutput>;

export class ListRequestsUseCase implements IUseCase<
  ListRequestsInput,
  ListRequestsOutput
> {
  constructor(private requestRepo: IRequestRepository) {}

  async execute(input: ListRequestsInput): Promise<ListRequestsOutput> {
    const filter: RequestFilter = {};

    if (input.audience_id) filter.audience_id = input.audience_id;
    if (input.musician_id) filter.musician_id = input.musician_id;
    if (input.status) filter.status = input.status;
    if (input.song_title) filter.song_title = input.song_title;
    if (input.artist) filter.artist = input.artist;
    if (input.created_after)
      filter.created_after = new Date(input.created_after);
    if (input.created_before)
      filter.created_before = new Date(input.created_before);

    const params = RequestSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: Object.keys(filter).length > 0 ? filter : null,
    });

    const searchResult = await this.requestRepo.search(params);

    return this.toOutput(searchResult);
  }

  private toOutput(searchResult: any): ListRequestsOutput {
    const items = searchResult.items.map((i: any) => {
      return RequestOutputMapper.toOutput(i);
    });
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}
