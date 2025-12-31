import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { MusicRequestMadeEvent } from "../music-request-made.event";

describe("MusicRequestMadeEvent Unit Tests", () => {
  test("should create a music request made event", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const songTitle = "Bohemian Rhapsody";
    const artist = "Queen";

    const event = new MusicRequestMadeEvent(
      audienceId,
      musicianId,
      songTitle,
      artist,
    );

    expect(event.aggregate_id).toBe(audienceId);
    expect(event.musician_id).toBe(musicianId);
    expect(event.song_title).toBe(songTitle);
    expect(event.artist).toBe(artist);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toBeInstanceOf(Date);
  });

  test("should create a music request made event without artist", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const songTitle = "Bohemian Rhapsody";

    const event = new MusicRequestMadeEvent(audienceId, musicianId, songTitle);

    expect(event.aggregate_id).toBe(audienceId);
    expect(event.musician_id).toBe(musicianId);
    expect(event.song_title).toBe(songTitle);
    expect(event.artist).toBeUndefined();
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toBeInstanceOf(Date);
  });

  test("should serialize event to JSON correctly", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const songTitle = "Bohemian Rhapsody";
    const artist = "Queen";

    const event = new MusicRequestMadeEvent(
      audienceId,
      musicianId,
      songTitle,
      artist,
    );
    const json = event.toJSON();

    expect(json).toEqual({
      aggregate_id: "123e4567-e89b-12d3-a456-426614174000",
      musician_id: musicianId,
      song_title: songTitle,
      artist: artist,
      event_version: 1,
      occurred_on: event.occurred_on.toISOString(),
    });
  });

  test("should create event from JSON correctly", () => {
    const audienceId = "123e4567-e89b-12d3-a456-426614174000";
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const songTitle = "Bohemian Rhapsody";
    const artist = "Queen";
    const occurredOn = new Date();

    const json = {
      aggregate_id: audienceId,
      musician_id: musicianId,
      song_title: songTitle,
      artist: artist,
      event_version: 1,
      occurred_on: occurredOn.toISOString(),
    };

    const event = MusicRequestMadeEvent.fromJSON(json);

    expect(event.aggregate_id.id).toBe(audienceId);
    expect(event.musician_id).toBe(musicianId);
    expect(event.song_title).toBe(songTitle);
    expect(event.artist).toBe(artist);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toEqual(occurredOn);
  });

  test("should create event from JSON without artist", () => {
    const audienceId = "123e4567-e89b-12d3-a456-426614174000";
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const songTitle = "Bohemian Rhapsody";
    const occurredOn = new Date();

    const json = {
      aggregate_id: audienceId,
      musician_id: musicianId,
      song_title: songTitle,
      event_version: 1,
      occurred_on: occurredOn.toISOString(),
    };

    const event = MusicRequestMadeEvent.fromJSON(json);

    expect(event.aggregate_id.id).toBe(audienceId);
    expect(event.musician_id).toBe(musicianId);
    expect(event.song_title).toBe(songTitle);
    expect(event.artist).toBeUndefined();
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toEqual(occurredOn);
  });
});
