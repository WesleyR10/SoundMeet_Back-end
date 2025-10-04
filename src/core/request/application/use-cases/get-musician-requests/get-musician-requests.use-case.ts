import { IRequestRepository } from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { GetMusicianRequestsInput } from "./get-musician-requests.input";

export type GetMusicianRequestsOutput = {
  requests: RequestOutput[];
  total_count: number;
  pending_count: number;
};

export class GetMusicianRequestsUseCase
  implements IUseCase<GetMusicianRequestsInput, GetMusicianRequestsOutput>
{
  constructor(private requestRepo: IRequestRepository) {}

  async execute(
    input: GetMusicianRequestsInput,
  ): Promise<GetMusicianRequestsOutput> {
    let requests;

    switch (input.status) {
      case "pending":
        requests = await this.requestRepo.findPendingRequestsByMusician(
          input.musician_id,
        );
        break;
      case "accepted":
        requests = await this.requestRepo.findAcceptedRequestsByMusician(
          input.musician_id,
        );
        break;
      case "rejected":
        requests = await this.requestRepo.findRejectedRequestsByMusician(
          input.musician_id,
        );
        break;
      default:
        requests = await this.requestRepo.findByMusicianId(input.musician_id);
        break;
    }

    // Ordenar por data de criação (mais recentes primeiro)
    requests.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    // Aplicar paginação ou limite
    let finalRequests;
    let totalCount;

    if (input.limit && input.limit > 0) {
      // Usar limite se especificado (compatibilidade com testes antigos)
      finalRequests = requests.slice(0, input.limit);
      totalCount = finalRequests.length;
    } else {
      // Usar paginação padrão
      const page = input.page ?? 1;
      const perPage = input.per_page ?? 15;
      const startIndex = (page - 1) * perPage;
      finalRequests = requests.slice(startIndex, startIndex + perPage);
      totalCount = requests.length; // Total antes da paginação
    }

    const pendingCount = await this.requestRepo.countPendingRequestsByMusician(
      input.musician_id,
    );

    return {
      requests: finalRequests.map((request) =>
        RequestOutputMapper.toOutput(request),
      ),
      total_count: totalCount,
      pending_count: pendingCount,
    };
  }
}
