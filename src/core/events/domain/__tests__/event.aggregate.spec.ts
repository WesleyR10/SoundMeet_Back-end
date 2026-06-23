import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { Event, EventCreateCommand } from "../event.aggregate";
import { EventActivatedEvent } from "../events/event-activated.event";
import { EventAttendeeAddedEvent } from "../events/event-attendee-added.event";
import { EventAttendeeRemovedEvent } from "../events/event-attendee-removed.event";
import { EventCancelledEvent } from "../events/event-cancelled.event";
import { EventCreatedEvent } from "../events/event-created.event";
import { EventFinishedEvent } from "../events/event-finished.event";
import { EventUpdatedEvent } from "../events/event-updated.event";

describe("Event Unit Tests", () => {
  test("should create an event with valid data", () => {
    const now = new Date();
    const command: EventCreateCommand = {
      establishment_id: new Uuid().id,
      name: "Event",
      description: "Description",
      start_at: now,
      end_at: new Date(now.getTime() + 60 * 60 * 1000),
      max_capacity: 10,
      is_public: true,
      cover_charge: 5,
    };

    const entity = Event.create(command);

    expect(entity.event_id).toBeDefined();
    expect(entity.establishment_id.id).toBe(command.establishment_id);
    expect(entity.name).toBe(command.name);
    expect(entity.status).toBe("scheduled");
    expect(entity.notification.hasErrors()).toBe(false);
    expect(
      entity.getUncommittedEvents().some((e) => e instanceof EventCreatedEvent),
    ).toBe(true);
  });

  test("should validate end_at greater than start_at", () => {
    const now = new Date();
    const entity = new Event({
      establishment_id: new Uuid(),
      name: "Event",
      start_at: now,
      end_at: now,
      status: "scheduled",
    });

    entity.validate();
    expect(entity.notification.hasErrors()).toBe(true);
    expect(entity.notification.toJSON()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          end_at: expect.arrayContaining([
            "end_at must be greater than start_at",
          ]),
        }),
      ]),
    );
  });

  test("should activate/cancel/finish with status rules", () => {
    const now = new Date();
    const entity = new Event({
      establishment_id: new Uuid(),
      name: "Event",
      start_at: now,
      end_at: new Date(now.getTime() + 1000),
      status: "scheduled",
    });

    entity.activate(now);
    expect(entity.status).toBe("active");
    expect(
      entity
        .getUncommittedEvents()
        .some((e) => e instanceof EventActivatedEvent),
    ).toBe(true);

    entity.cancel(now);
    expect(entity.status).toBe("cancelled");
    expect(
      entity
        .getUncommittedEvents()
        .some((e) => e instanceof EventCancelledEvent),
    ).toBe(true);

    const eventsCountBefore = entity.getUncommittedEvents().length;
    entity.activate(now);
    expect(entity.notification.hasErrors()).toBe(true);
    expect(entity.getUncommittedEvents().length).toBe(eventsCountBefore);
  });

  test("should finish and emit event", () => {
    const now = new Date();
    const entity = new Event({
      establishment_id: new Uuid(),
      name: "Event",
      start_at: now,
      end_at: new Date(now.getTime() + 1000),
      status: "active",
    });

    entity.finish(now);
    expect(entity.status).toBe("completed");
    expect(
      entity
        .getUncommittedEvents()
        .some((e) => e instanceof EventFinishedEvent),
    ).toBe(true);
  });

  test("should update and emit event", () => {
    const now = new Date();
    const entity = new Event({
      establishment_id: new Uuid(),
      name: "Event",
      start_at: now,
      end_at: new Date(now.getTime() + 1000),
      status: "scheduled",
    });

    entity.update({ name: "New name" }, now);
    expect(entity.name).toBe("New name");
    expect(entity.notification.hasErrors()).toBe(false);
    expect(
      entity.getUncommittedEvents().some((e) => e instanceof EventUpdatedEvent),
    ).toBe(true);
  });

  test("should enforce max capacity when adding attendees", () => {
    const now = new Date();
    const entity = new Event({
      establishment_id: new Uuid(),
      name: "Event",
      start_at: now,
      end_at: new Date(now.getTime() + 1000),
      status: "scheduled",
      max_capacity: 1,
      current_capacity: 0,
    });

    const audienceId = new Uuid().id;
    entity.addAttendee(audienceId, now);
    expect(entity.current_capacity).toBe(1);
    expect(
      entity
        .getUncommittedEvents()
        .some((e) => e instanceof EventAttendeeAddedEvent),
    ).toBe(true);

    const eventsCountBefore = entity.getUncommittedEvents().length;
    entity.addAttendee(new Uuid().id, now);
    expect(entity.current_capacity).toBe(1);
    expect(entity.notification.hasErrors()).toBe(true);
    expect(entity.getUncommittedEvents().length).toBe(eventsCountBefore);
  });

  test("should remove attendee and emit event", () => {
    const now = new Date();
    const entity = new Event({
      establishment_id: new Uuid(),
      name: "Event",
      start_at: now,
      end_at: new Date(now.getTime() + 1000),
      status: "scheduled",
      max_capacity: 10,
      current_capacity: 1,
    });

    const audienceId = new Uuid().id;
    entity.removeAttendee(audienceId, now);
    expect(entity.current_capacity).toBe(0);
    expect(
      entity
        .getUncommittedEvents()
        .some((e) => e instanceof EventAttendeeRemovedEvent),
    ).toBe(true);
  });
});
