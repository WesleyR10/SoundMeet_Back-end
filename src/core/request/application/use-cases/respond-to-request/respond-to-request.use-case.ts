import { Event, EventId, IEventRepository } from "../../../../events/domain";
import {
  IMusicianRepository,
  Musician,
  MusicianId,
} from "../../../../musician/domain";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Request, RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import {
  RespondToRequestAction,
  RespondToRequestInput,
} from "./respond-to-request.input";

export type RespondToRequestOutput = RequestOutput;

export class RespondToRequestUseCase implements IUseCase<
  RespondToRequestInput,
  RespondToRequestOutput
> {
  constructor(
    private requestRepo: IRequestRepository,
    private eventRepo: IEventRepository,
    private musicianRepo: IMusicianRepository,
    private readonly requestResponseTimeMinutes: number,
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: RespondToRequestInput): Promise<RespondToRequestOutput> {
    const requestId = new RequestId(input.request_id);
    const entity = await this.requestRepo.findById(requestId);

    if (!entity) {
      throw new NotFoundError(input.request_id, Request);
    }

    await this.validateEventAndMusician(
      entity.event_id.id,
      entity.musician_id.id,
    );

    // Validar que apenas o músico destinatário pode responder
    if (entity.musician_id.id !== input.musician_id) {
      throw new EntityValidationError([
        {
          musician_id: ["You can only respond to requests directed to you"],
        },
      ]);
    }

    // Validar que o pedido está pendente
    if (!entity.isPending) {
      throw new EntityValidationError([
        {
          status: ["Only pending requests can be responded to"],
        },
      ]);
    }

    // Validar regras de negócio específicas para aceitar/rejeitar
    if (input.action === RespondToRequestAction.ACCEPT) {
      if (!entity.canBeAccepted(this.requestResponseTimeMinutes)) {
        throw new EntityValidationError([
          {
            status: [
              "This request cannot be accepted (too old or invalid status)",
            ],
          },
        ]);
      }
    } else if (input.action === RespondToRequestAction.REJECT) {
      if (!entity.canBeRejected()) {
        throw new EntityValidationError([
          {
            status: ["This request cannot be rejected"],
          },
        ]);
      }
    }

    // Validar se ainda está dentro do tempo de resposta
    if (!entity.isWithinResponseTime(this.requestResponseTimeMinutes)) {
      throw new EntityValidationError([
        {
          created_at: ["Request has expired - response time limit exceeded"],
        },
      ]);
    }

    // Executar ação
    if (input.action === RespondToRequestAction.ACCEPT) {
      entity.accept();
    } else if (input.action === RespondToRequestAction.REJECT) {
      entity.reject(input.rejection_reason);
    } else {
      throw new EntityValidationError([
        {
          action: ["Action must be either 'accept' or 'reject'"],
        },
      ]);
    }

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.requestRepo.update(entity);

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entity);
      await this.domainEventMediator.publishIntegrationEvents(entity);
      entity.clearEvents();
    }

    return RequestOutputMapper.toOutput(entity);
  }

  private async validateEventAndMusician(
    event_id: string,
    musician_id: string,
  ): Promise<void> {
    const eventId = new EventId(event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError(event_id, Event);
    }

    if (event.status !== "active") {
      throw new EntityValidationError([
        {
          event_id: ["Event is not active"],
        },
      ]);
    }

    const musicianId = new MusicianId(musician_id);
    const musician = await this.musicianRepo.findById(musicianId);
    if (!musician) {
      throw new NotFoundError(musician_id, Musician);
    }

    musician.ensureIsActive();
    if (musician.notification.hasErrors()) {
      throw new EntityValidationError(musician.notification.toJSON());
    }

    const isPerformer = await this.eventRepo.isMusicianPerformer(
      eventId,
      musician_id,
    );
    if (!isPerformer) {
      throw new EntityValidationError([
        {
          musician_id: ["Musician is not a performer in this event"],
        },
      ]);
    }
  }
}
