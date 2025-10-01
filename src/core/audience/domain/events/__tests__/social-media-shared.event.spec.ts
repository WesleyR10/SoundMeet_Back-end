import { SocialMediaSharedEvent } from "../social-media-shared.event";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";

describe("SocialMediaSharedEvent Unit Tests", () => {
  test("should create a social media shared event", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const platform = "instagram";

    const event = new SocialMediaSharedEvent(audienceId, musicianId, platform);

    expect(event.aggregate_id).toBe(audienceId);
    expect(event.musician_id).toBe(musicianId);
    expect(event.platform).toBe(platform);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toBeInstanceOf(Date);
  });

  test("should serialize event to JSON correctly", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const platform = "facebook";

    const event = new SocialMediaSharedEvent(audienceId, musicianId, platform);
    const json = event.toJSON();

    expect(json).toEqual({
      aggregate_id: "123e4567-e89b-12d3-a456-426614174000",
      musician_id: musicianId,
      platform: platform,
      event_version: 1,
      occurred_on: event.occurred_on.toISOString(),
    });
  });

  test("should create event from JSON correctly", () => {
    const audienceId = "123e4567-e89b-12d3-a456-426614174000";
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const platform = "twitter";
    const occurredOn = new Date();

    const json = {
      aggregate_id: audienceId,
      musician_id: musicianId,
      platform: platform,
      event_version: 1,
      occurred_on: occurredOn.toISOString(),
    };

    const event = SocialMediaSharedEvent.fromJSON(json);

    expect(event.aggregate_id.id).toBe(audienceId);
    expect(event.musician_id).toBe(musicianId);
    expect(event.platform).toBe(platform);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toEqual(occurredOn);
  });

  test("should handle different social media platforms", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const musicianId = "987e6543-e21b-45d3-b789-426614174000";
    const platforms = ["instagram", "facebook", "twitter", "tiktok", "youtube"];

    platforms.forEach((platform) => {
      const event = new SocialMediaSharedEvent(
        audienceId,
        musicianId,
        platform,
      );

      expect(event.platform).toBe(platform);
      expect(event.aggregate_id).toBe(audienceId);
      expect(event.musician_id).toBe(musicianId);
    });
  });
});
