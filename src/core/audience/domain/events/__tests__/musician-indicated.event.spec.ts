import { MusicianIndicatedEvent } from "../musician-indicated.event";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";

describe("MusicianIndicatedEvent Unit Tests", () => {
  test("should create a musician indicated event", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const establishmentId = "456e7890-e12b-34d5-c678-426614174000";
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";

    const event = new MusicianIndicatedEvent(
      audienceId,
      establishmentId,
      musicianId,
    );

    expect(event.aggregate_id).toBe(audienceId);
    expect(event.establishment_id).toBe(establishmentId);
    expect(event.musician_id).toBe(musicianId);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toBeInstanceOf(Date);
  });

  test("should serialize event to JSON correctly", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const establishmentId = "456e7890-e12b-34d5-c678-426614174000";
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";

    const event = new MusicianIndicatedEvent(
      audienceId,
      establishmentId,
      musicianId,
    );
    const json = event.toJSON();

    expect(json).toEqual({
      aggregate_id: "123e4567-e89b-12d3-a456-426614174000",
      establishment_id: establishmentId,
      musician_id: musicianId,
      event_version: 1,
      occurred_on: event.occurred_on.toISOString(),
    });
  });

  test("should create event from JSON correctly", () => {
    const audienceId = "123e4567-e89b-12d3-a456-426614174000";
    const establishmentId = "456e7890-e12b-34d5-c678-426614174000";
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const occurredOn = new Date();

    const json = {
      aggregate_id: audienceId,
      establishment_id: establishmentId,
      musician_id: musicianId,
      event_version: 1,
      occurred_on: occurredOn.toISOString(),
    };

    const event = MusicianIndicatedEvent.fromJSON(json);

    expect(event.aggregate_id.id).toBe(audienceId);
    expect(event.establishment_id).toBe(establishmentId);
    expect(event.musician_id).toBe(musicianId);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toEqual(occurredOn);
  });
});
