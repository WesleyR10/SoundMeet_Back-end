import { Uuid } from "../../../../shared/domain";
import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { EventAttendee, EventAttendeeId } from "../../../domain";
import { EventAttendeeModel } from "./event-attendee-model";

export class EventAttendeeModelMapper {
  static toModel(entity: EventAttendee): EventAttendeeModel {
    return {
      id: entity.event_attendee_id.id,
      eventId: entity.event_id.id,
      audienceId: entity.audience_id.id,
      joinedAt: entity.joined_at,
      leftAt: entity.left_at,
      is_active: entity.is_active,
    };
  }

  static toEntity(model: EventAttendeeModel): EventAttendee {
    const entity = new EventAttendee({
      event_attendee_id: new EventAttendeeId(model.id),
      event_id: new Uuid(model.eventId),
      audience_id: new Uuid(model.audienceId),
      joined_at: model.joinedAt,
      left_at: model.leftAt,
      is_active: model.is_active,
    });

    entity.validate();
    if (entity.notification.hasErrors()) {
      throw new LoadEntityError(entity.notification.toJSON());
    }

    return entity;
  }
}
