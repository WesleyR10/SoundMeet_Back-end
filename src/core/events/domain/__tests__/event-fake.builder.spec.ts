import { InvariantViolationError } from "../../../shared/domain/errors/invariant-violation.error";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { EventId } from "../event.aggregate";
import { EventFakeBuilder } from "../event-fake.builder";

describe("EventFakeBuilder Unit Tests", () => {
  describe("event_id prop", () => {
    const faker = EventFakeBuilder.aEvent();

    test("should throw error when any with methods has called", () => {
      expect(() => faker.event_id).toThrowError(
        new InvariantViolationError(
          "Property event_id not have a factory, use 'with' methods",
        ),
      );
    });

    test("should be undefined", () => {
      expect(faker["_event_id"]).toBeUndefined();
    });

    test("withEventId", () => {
      const id = new EventId();
      const $this = faker.withEventId(id);
      expect($this).toBeInstanceOf(EventFakeBuilder);
      expect(faker["_event_id"]).toBe(id);
      expect(faker.event_id).toBe(id);
    });

    test("should pass index to event_id factory", () => {
      const ids = [new EventId(), new EventId()];
      const fakerMany = EventFakeBuilder.theEvents(2);
      fakerMany.withEventId((index) => ids[index]);
      const events = fakerMany.build();
      expect(events[0].event_id.id).toBe(ids[0].id);
      expect(events[1].event_id.id).toBe(ids[1].id);
    });
  });

  describe("created_at prop", () => {
    const faker = EventFakeBuilder.aEvent();

    test("should throw error when any with methods has called", () => {
      expect(() => faker.created_at).toThrowError(
        new InvariantViolationError(
          "Property created_at not have a factory, use 'with' methods",
        ),
      );
    });

    test("withCreatedAt", () => {
      const date = new Date();
      const $this = faker.withCreatedAt(date);
      expect($this).toBeInstanceOf(EventFakeBuilder);
      expect(faker.created_at).toBe(date);
    });

    test("should pass index to created_at factory", () => {
      const date = new Date();
      const fakerMany = EventFakeBuilder.theEvents(2);
      fakerMany.withCreatedAt((index) => new Date(date.getTime() + index));
      const events = fakerMany.build();
      expect(events[0].created_at.getTime()).toBe(date.getTime() + 0);
      expect(events[1].created_at.getTime()).toBe(date.getTime() + 1);
    });
  });

  describe("build", () => {
    test("should build a valid event", () => {
      const event = EventFakeBuilder.aEvent().build();
      expect(event.event_id).toBeInstanceOf(EventId);
      expect(event.establishment_id).toBeInstanceOf(Uuid);
      expect(event.notification.hasErrors()).toBe(false);
    });

    test("should build many events", () => {
      const events = EventFakeBuilder.theEvents(2).build();
      expect(events).toHaveLength(2);
      expect(events[0].event_id).toBeInstanceOf(EventId);
      expect(events[1].event_id).toBeInstanceOf(EventId);
    });
  });
});
