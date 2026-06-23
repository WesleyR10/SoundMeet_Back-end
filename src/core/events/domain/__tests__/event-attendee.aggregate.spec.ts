import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import {
  EventAttendee,
  EventAttendeeCreateCommand,
} from "../event-attendee.aggregate";

describe("EventAttendee Unit Tests", () => {
  test("should create an active attendance record", () => {
    const command: EventAttendeeCreateCommand = {
      event_id: new Uuid().id,
      audience_id: new Uuid().id,
    };

    const entity = EventAttendee.create(command);

    expect(entity.event_attendee_id).toBeDefined();
    expect(entity.event_id.id).toBe(command.event_id);
    expect(entity.audience_id.id).toBe(command.audience_id);
    expect(entity.is_active).toBe(true);
    expect(entity.isActive).toBe(true);
    expect(entity.left_at).toBeNull();
    expect(entity.notification.hasErrors()).toBe(false);
  });

  test("should leave the event and become inactive", () => {
    const entity = EventAttendee.create({
      event_id: new Uuid().id,
      audience_id: new Uuid().id,
    });

    const leftAt = new Date();
    entity.leave(leftAt);

    expect(entity.is_active).toBe(false);
    expect(entity.isActive).toBe(false);
    expect(entity.left_at).toBe(leftAt);
    expect(entity.notification.hasErrors()).toBe(false);
  });

  test("should not leave twice", () => {
    const entity = EventAttendee.create({
      event_id: new Uuid().id,
      audience_id: new Uuid().id,
    });

    entity.leave(new Date());
    entity.leave(new Date());

    expect(entity.notification.hasErrors()).toBe(true);
  });

  test("should rejoin after leaving", () => {
    const entity = EventAttendee.create({
      event_id: new Uuid().id,
      audience_id: new Uuid().id,
    });

    entity.leave(new Date());
    const rejoinAt = new Date();
    entity.rejoin(rejoinAt);

    expect(entity.is_active).toBe(true);
    expect(entity.left_at).toBeNull();
    expect(entity.joined_at).toBe(rejoinAt);
  });

  test("should build using fake builder", () => {
    const active = EventAttendee.fake().aEventAttendee().build();
    expect(active.is_active).toBe(true);

    const inactive = EventAttendee.fake().aEventAttendee().inactive().build();
    expect(inactive.is_active).toBe(false);
    expect(inactive.left_at).not.toBeNull();
  });
});
