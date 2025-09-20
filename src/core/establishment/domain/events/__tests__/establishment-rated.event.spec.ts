import { EstablishmentRatedEvent } from "../establishment-rated.event";
import { Rating } from "../../../../shared/domain/value-objects/rating.vo";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";

describe("EstablishmentRatedEvent Unit Tests", () => {
  test("should create an establishment rated event", () => {
    const establishmentId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const ratingValue = 4.5;
    const rating = new Rating(ratingValue);
    const comment = "Great place!";
    const ratedBy = new Uuid("987e6543-e21b-45d3-b789-426614174000");

    const event = new EstablishmentRatedEvent(
      establishmentId,
      rating,
      comment,
      ratedBy,
    );

    expect(event.aggregate_id).toBe(establishmentId);
    expect(event.rating).toBe(rating);
    expect(event.rating.value).toBe(ratingValue);
    expect(event.comment).toBe(comment);
    expect(event.rated_by).toBe(ratedBy);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toBeInstanceOf(Date);
  });

  test("should serialize event to JSON correctly", () => {
    const establishmentId = new Uuid("123e4567-e89b-12d3-a456-426614174000");
    const ratingValue = 4.5;
    const rating = new Rating(ratingValue);
    const comment = "Great place!";
    const ratedBy = new Uuid("987e6543-e21b-45d3-b789-426614174000");

    const event = new EstablishmentRatedEvent(
      establishmentId,
      rating,
      comment,
      ratedBy,
    );
    const json = event.toJSON();

    expect(json).toEqual({
      aggregate_id: "123e4567-e89b-12d3-a456-426614174000",
      rating: ratingValue,
      comment: comment,
      rated_by: "987e6543-e21b-45d3-b789-426614174000",
      event_version: 1,
      occurred_on: event.occurred_on.toISOString(),
    });
  });

  test("should create event from JSON correctly", () => {
    const establishmentId = "123e4567-e89b-12d3-a456-426614174000";
    const ratingValue = 4.5;
    const comment = "Great place!";
    const ratedBy = "987e6543-e21b-45d3-b789-426614174000";
    const occurredOn = new Date();

    const json = {
      aggregate_id: establishmentId,
      rating: ratingValue,
      comment: comment,
      rated_by: ratedBy,
      event_version: 1,
      occurred_on: occurredOn.toISOString(),
    };

    const event = EstablishmentRatedEvent.fromJSON(json);

    expect(event.aggregate_id.id).toBe(establishmentId);
    expect(event.rating).toBeInstanceOf(Rating);
    expect(event.rating.value).toBe(ratingValue);
    expect(event.comment).toBe(comment);
    expect(event.rated_by.id).toBe(ratedBy);
    expect(event.event_version).toBe(1);
    expect(event.occurred_on).toEqual(occurredOn);
  });
});
