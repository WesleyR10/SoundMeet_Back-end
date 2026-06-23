import { EventAttendee } from "@core/events/domain";

export type EventAttendeeOutput = {
  id: string;
  event_id: string;
  audience_id: string;
  joined_at: Date;
  left_at: Date | null;
  is_active: boolean;
};

export class EventAttendeeOutputMapper {
  static toOutput(entity: EventAttendee): EventAttendeeOutput {
    return {
      id: entity.event_attendee_id.id,
      event_id: entity.event_id.id,
      audience_id: entity.audience_id.id,
      joined_at: entity.joined_at,
      left_at: entity.left_at,
      is_active: entity.is_active,
    };
  }
}
