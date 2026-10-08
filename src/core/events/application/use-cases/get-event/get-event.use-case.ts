import { Event, EventId, IEventRepository } from "@core/events/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EventOutput, EventOutputMapper } from "../common/event-output";

export type GetEventInput = {
  establishment_id: string;
  event_id: string;
  /** Ver `ListEventsInput.requesting_establishment_ids` (Bloco 9.4d). */
  requesting_establishment_ids?: string[] | null;
  is_admin?: boolean;
};

export class GetEventUseCase implements IUseCase<GetEventInput, EventOutput> {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(input: GetEventInput): Promise<EventOutput> {
    const eventId = new EventId(input.event_id);
    const entity = await this.eventRepo.findById(eventId);
    if (!entity || entity.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }

    // Bloco 9.4d — o irmão do vazamento da listagem: evento privado era
    // legível por id nesta rota @Public(). 404 (e não 403) de propósito:
    // responder "existe, mas você não pode ver" já confirma a existência de
    // um evento privado a quem não deveria saber dele.
    const canSeePrivate =
      input.is_admin ||
      (input.requesting_establishment_ids ?? []).includes(
        input.establishment_id,
      );

    if (!entity.is_public && !canSeePrivate) {
      throw new NotFoundError(input.event_id, Event);
    }

    return EventOutputMapper.toOutput(entity);
  }
}
