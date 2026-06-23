import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { RequestFeedback } from "../../../domain/request-feedback.aggregate";
import { IRequestFeedbackRepository } from "../../../domain/request-feedback.repository";
import {
  RequestFeedbackOutput,
  RequestFeedbackOutputMapper,
} from "../common/request-feedback-output";
import { GetRequestFeedbackInput } from "./get-request-feedback.input";

export type GetRequestFeedbackOutput = RequestFeedbackOutput;

export class GetRequestFeedbackUseCase implements IUseCase<
  GetRequestFeedbackInput,
  GetRequestFeedbackOutput
> {
  constructor(
    private readonly requestFeedbackRepo: IRequestFeedbackRepository,
  ) {}

  async execute(
    input: GetRequestFeedbackInput,
  ): Promise<GetRequestFeedbackOutput> {
    const entity = await this.requestFeedbackRepo.findByRequestId(
      input.request_id,
    );

    if (!entity) {
      throw new NotFoundError(input.request_id, RequestFeedback);
    }

    return RequestFeedbackOutputMapper.toOutput(entity);
  }
}
