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
import {
  assertRequestParticipant,
  isRequestViewerScoped,
} from "../common/request-viewer";
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
    // Mesmo convênio de GetRequestUseCase.ensureCanView — sem identidade a
    // chamada é interna/admin, sem restrição.
    if (!isRequestViewerScoped(input)) return;

    const request = await this.requestRepo.findById(
      new RequestId(input.request_id),
    );
    if (!request) {
      throw new NotFoundError(input.request_id, Request);
    }

    const viewerIds = input.requesting_participant_ids ?? [];
    const isDirectParticipant =
      viewerIds.includes(request.audience_id.id) ||
      viewerIds.includes(request.musician_id.id);

    const event = isDirectParticipant
      ? null
      : await this.eventRepo.findById(new EventId(request.event_id.id));

    assertRequestParticipant(
      input,
      {
        audience_id: request.audience_id.id,
        musician_id: request.musician_id.id,
        establishment_id: event?.establishment_id.id ?? null,
      },
      "esta avaliação",
    );
  }
}
