import { ForbiddenException } from "@nestjs/common";

import { EventId, IEventRepository } from "../../../../events/domain";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Request, RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
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
    private readonly requestRepo: IRequestRepository,
    private readonly eventRepo: IEventRepository,
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

    await this.ensureCanView(input);

    return RequestFeedbackOutputMapper.toOutput(entity);
  }

  // Mesmo escopo de participantes de GetRequestUseCase — a avaliação em si
  // não tem audience_id/musician_id, então resolve via o Request pai.
  private async ensureCanView(input: GetRequestFeedbackInput): Promise<void> {
    // Mesmo convênio de GetRequestUseCase.ensureCanView — requesting_user_id
    // ausente = chamada interna/admin, sem restrição.
    if (input.is_admin || !input.requesting_user_id) return;

    const request = await this.requestRepo.findById(
      new RequestId(input.request_id),
    );
    if (!request) {
      throw new NotFoundError(input.request_id, Request);
    }

    if (
      request.audience_id.id === input.requesting_user_id ||
      request.musician_id.id === input.requesting_user_id
    ) {
      return;
    }

    const event = await this.eventRepo.findById(
      new EventId(request.event_id.id),
    );
    if (event && event.establishment_id.id === input.requesting_user_id) {
      return;
    }

    throw new ForbiddenException(
      "Você não tem permissão para ver esta avaliação.",
    );
  }
}
