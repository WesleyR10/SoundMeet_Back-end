import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  IRequestRepository,
  RequestFilter,
  RequestSearchParams,
} from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { GetMusicianRequestsInput } from "./get-musician-requests.input";

export type GetMusicianRequestsOutput = {
  requests: RequestOutput[];
  total_count: number;
  pending_count: number;
};

export class GetMusicianRequestsUseCase implements IUseCase<
  GetMusicianRequestsInput,
  GetMusicianRequestsOutput
> {
  constructor(private requestRepo: IRequestRepository) {}

  async execute(
    input: GetMusicianRequestsInput,
  ): Promise<GetMusicianRequestsOutput> {
    const page = input.page ?? 1;
    const perPage =
      input.limit && input.limit > 0 ? input.limit : (input.per_page ?? 15);

    const filter: RequestFilter = {
      musician_id: input.musician_id,
      ...(input.status && input.status !== "all"
        ? { status: input.status }
        : {}),
    };

    const searchResult = await this.requestRepo.search(
      RequestSearchParams.create({
        page,
        per_page: perPage,
        sort: "created_at",
        sort_dir: "desc",
        filter,
      }),
    );

    const pendingCount = await this.requestRepo.countPendingRequestsByMusician(
      input.musician_id,
    );

    return {
      requests: searchResult.items.map((request) =>
        RequestOutputMapper.toOutput(request),
      ),
      total_count: searchResult.total,
      pending_count: pendingCount,
    };
  }
}
