import { SongVotedEvent } from "../song-voted.event";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";

describe("SongVotedEvent Unit Tests", () => {
  test("should create a song voted event with up vote", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const requestId = "987e6543-e21b-45d3-b789-426614174000";
    const vote = "up";

    const event = new SongVotedEvent(audienceId, requestId, vote);

    expect(event.aggregate_id).toBe(audienceId);
    expect(event.request_id).toBe(requestId);
    expect(event.vote).toBe(vote);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toBeInstanceOf(Date);
  });

  test("should create a song voted event with down vote", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const requestId = "987e6543-e21b-45d3-b789-426614174000";
    const vote = "down";

    const event = new SongVotedEvent(audienceId, requestId, vote);

    expect(event.aggregate_id).toBe(audienceId);
    expect(event.request_id).toBe(requestId);
    expect(event.vote).toBe(vote);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toBeInstanceOf(Date);
  });

  test("should serialize event to JSON correctly", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const requestId = "987e6543-e21b-45d3-b789-426614174000";
    const vote = "up";

    const event = new SongVotedEvent(audienceId, requestId, vote);
    const json = event.toJSON();

    expect(json).toEqual({
      aggregate_id: "123e4567-e89b-12d3-a456-426614174000",
      request_id: requestId,
      vote: vote,
      event_version: 1,
      occurred_on: event.occurred_on.toISOString(),
    });
  });

  test("should create event from JSON correctly", () => {
    const audienceId = "123e4567-e89b-12d3-a456-426614174000";
    const requestId = "987e6543-e21b-45d3-b789-426614174000";
    const vote = "down";
    const occurredOn = new Date();

    const json = {
      aggregate_id: audienceId,
      request_id: requestId,
      vote: vote,
      event_version: 1,
      occurred_on: occurredOn.toISOString(),
    };

    const event = SongVotedEvent.fromJSON(json);

    expect(event.aggregate_id.id).toBe(audienceId);
    expect(event.request_id).toBe(requestId);
    expect(event.vote).toBe(vote);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toEqual(occurredOn);
  });

  test("should handle both vote types", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const requestId = "987e6543-e21b-45d3-b789-426614174000";
    const votes: ("up" | "down")[] = ["up", "down"];

    votes.forEach((vote) => {
      const event = new SongVotedEvent(audienceId, requestId, vote);

      expect(event.vote).toBe(vote);
      expect(event.aggregate_id).toBe(audienceId);
      expect(event.request_id).toBe(requestId);
    });
  });
});
