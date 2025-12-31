import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { TipSentEvent } from "../tip-sent.event";

describe("TipSentEvent Unit Tests", () => {
  test("should create a tip sent event", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const amount = 25.5;
    const message = "Great performance!";

    const event = new TipSentEvent(audienceId, musicianId, amount, message);

    expect(event.aggregate_id).toBe(audienceId);
    expect(event.musician_id).toBe(musicianId);
    expect(event.amount).toBe(amount);
    expect(event.message).toBe(message);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toBeInstanceOf(Date);
  });

  test("should create a tip sent event without message", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const amount = 25.5;

    const event = new TipSentEvent(audienceId, musicianId, amount);

    expect(event.aggregate_id).toBe(audienceId);
    expect(event.musician_id).toBe(musicianId);
    expect(event.amount).toBe(amount);
    expect(event.message).toBeUndefined();
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toBeInstanceOf(Date);
  });

  test("should serialize event to JSON correctly", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const amount = 25.5;
    const message = "Great performance!";

    const event = new TipSentEvent(audienceId, musicianId, amount, message);
    const json = event.toJSON();

    expect(json).toEqual({
      aggregate_id: "123e4567-e89b-12d3-a456-426614174000",
      musician_id: musicianId,
      amount: amount,
      message: message,
      event_version: 1,
      occurred_on: event.occurred_on.toISOString(),
    });
  });

  test("should create event from JSON correctly", () => {
    const audienceId = "123e4567-e89b-12d3-a456-426614174000";
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const amount = 25.5;
    const message = "Great performance!";
    const occurredOn = new Date();

    const json = {
      aggregate_id: audienceId,
      musician_id: musicianId,
      amount: amount,
      message: message,
      event_version: 1,
      occurred_on: occurredOn.toISOString(),
    };

    const event = TipSentEvent.fromJSON(json);

    expect(event.aggregate_id.id).toBe(audienceId);
    expect(event.musician_id).toBe(musicianId);
    expect(event.amount).toBe(amount);
    expect(event.message).toBe(message);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toEqual(occurredOn);
  });

  test("should create event from JSON without message", () => {
    const audienceId = "123e4567-e89b-12d3-a456-426614174000";
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const amount = 25.5;
    const occurredOn = new Date();

    const json = {
      aggregate_id: audienceId,
      musician_id: musicianId,
      amount: amount,
      event_version: 1,
      occurred_on: occurredOn.toISOString(),
    };

    const event = TipSentEvent.fromJSON(json);

    expect(event.aggregate_id.id).toBe(audienceId);
    expect(event.musician_id).toBe(musicianId);
    expect(event.amount).toBe(amount);
    expect(event.message).toBeUndefined();
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toEqual(occurredOn);
  });
});
