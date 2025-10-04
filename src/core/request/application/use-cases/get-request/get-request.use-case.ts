import { IRequestRepository } from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { RequestId } from "../../../domain/request.aggregate";
import { NotFoundError } from "../../../../shared/domain/errors";

export type GetRequestInput = {
  id: string;
};

export type GetRequestOutput = RequestOutput;

export class GetRequestUseCase
  implements IUseCase<GetRequestInput, GetRequestOutput>
{
  constructor(private requestRepo: IRequestRepository) {}

  async execute(input: GetRequestInput): Promise<GetRequestOutput> {
    const requestId = new RequestId(input.id);
    const entity = await this.requestRepo.findById(requestId);

    if (!entity) {
      throw new NotFoundError(input.id, "Request");
    }

    return RequestOutputMapper.toOutput(entity);
  }
}
