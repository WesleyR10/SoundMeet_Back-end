import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Request, RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { RequestFeedback } from "../../../domain/request-feedback.aggregate";
import { IRequestFeedbackRepository } from "../../../domain/request-feedback.repository";
import {
  RequestFeedbackOutput,
  RequestFeedbackOutputMapper,
} from "../common/request-feedback-output";
import { CreateRequestFeedbackInput } from "./create-request-feedback.input";

export type CreateRequestFeedbackOutput = RequestFeedbackOutput;

export class CreateRequestFeedbackUseCase implements IUseCase<
  CreateRequestFeedbackInput,
  CreateRequestFeedbackOutput
> {
  constructor(
    private readonly requestFeedbackRepo: IRequestFeedbackRepository,
    private readonly requestRepo: IRequestRepository,
  ) {}

  async execute(
    input: CreateRequestFeedbackInput,
  ): Promise<CreateRequestFeedbackOutput> {
    const requestId = new RequestId(input.request_id);
    const request = await this.requestRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError(input.request_id, Request);
    }

    if (input.musician_id && request.musician_id.id !== input.musician_id) {
      throw new ForbiddenException(
        "Você não tem permissão para avaliar este pedido.",
      );
    }

    const existingFeedback = await this.requestFeedbackRepo.findByRequestId(
      input.request_id,
    );
    if (existingFeedback) {
      throw new EntityValidationError([
        {
          request_id: ["Feedback already exists for this request"],
        },
      ]);
    }

    const entity = RequestFeedback.create({
      request_id: input.request_id,
      rating: input.rating,
      comment: input.comment,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.requestFeedbackRepo.insert(entity);

    return RequestFeedbackOutputMapper.toOutput(entity);
  }
}
