import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { SocialMediaSharedEvent } from "../social-media-shared.event";

describe("SocialMediaSharedEvent Unit Tests", () => {
  test("should create a social media shared event", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const requestId = "987e6543-e21b-45d3-b789-426614174000";
    const platform = "instagram";
    const message = "Check out this amazing song!";

    const event = new SocialMediaSharedEvent(
      audienceId,
      requestId,
      platform,
      message,
    );

    expect(event.aggregate_id).toBe(audienceId);
    expect(event.request_id).toBe(requestId);
    expect(event.platform).toBe(platform);
    expect(event.message).toBe(message);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toBeInstanceOf(Date);
  });

  test("should serialize event to JSON correctly", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const requestId = "987e6543-e21b-45d3-b789-426614174000";
    const platform = "facebook";
    const message = "Great music here!";

    const event = new SocialMediaSharedEvent(
      audienceId,
      requestId,
      platform,
      message,
    );
    const json = event.toJSON();

    expect(json).toEqual({
      aggregate_id: "123e4567-e89b-12d3-a456-426614174000",
      request_id: requestId,
      platform: platform,
      message: message,
      event_version: 1,
      occurred_on: event.occurred_on.toISOString(),
    });
  });

  test("should create event from JSON correctly", () => {
    const audienceId = "123e4567-e89b-12d3-a456-426614174000";
    const requestId = "987e6543-e21b-45d3-b789-426614174000";
    const platform = "twitter";
    const message = "Amazing performance!";
    const occurredOn = new Date();

    const json = {
      aggregate_id: audienceId,
      request_id: requestId,
      platform: platform,
      message: message,
      event_version: 1,
      occurred_on: occurredOn.toISOString(),
    };

    const event = SocialMediaSharedEvent.fromJSON(json);

    expect(event.aggregate_id.id).toBe(audienceId);
    expect(event.request_id).toBe(requestId);
    expect(event.platform).toBe(platform);
    expect(event.message).toBe(message);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toEqual(occurredOn);
  });

  test("should handle different social media platforms", () => {
    const audienceId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const requestId = "987e6543-e21b-45d3-b789-426614174000";
    const platforms = ["instagram", "facebook", "twitter", "tiktok", "youtube"];

    platforms.forEach((platform) => {
      const event = new SocialMediaSharedEvent(
        audienceId,
        requestId,
        platform,
        "Test message",
      );

      expect(event.platform).toBe(platform);
      expect(event.aggregate_id).toBe(audienceId);
      expect(event.request_id).toBe(requestId);
    });
  });
});
