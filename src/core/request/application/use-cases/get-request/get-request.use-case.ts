import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Request, RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { GetRequestInput } from "./get-request.input";

export type GetRequestOutput = RequestOutput;

export class GetRequestUseCase implements IUseCase<
  GetRequestInput,
  GetRequestOutput
> {
  constructor(private requestRepo: IRequestRepository) {}

  async execute(input: GetRequestInput): Promise<GetRequestOutput> {
    const requestId = new RequestId(input.id);
    const entity = await this.requestRepo.findById(requestId);

    if (!entity) {
      throw new NotFoundError(input.id, Request);
    }

    return RequestOutputMapper.toOutput(entity);
  }
}
