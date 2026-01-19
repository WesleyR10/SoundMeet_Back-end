import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { EstablishmentAnalytics } from "../establishment-analytics.entity";

describe("EstablishmentAnalytics Unit Tests", () => {
  it("should create with defaults", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");

    const entity = EstablishmentAnalytics.create({
      establishment_id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      date,
    });

    expect(entity.events_hosted).toBe(0);
    expect(entity.total_attendees).toBe(0);
    expect(entity.musicians_hired).toBe(0);
    expect(entity.total_spent).toBe(0);
    expect(entity.avg_rating).toBe(0);
    expect(entity.date).toBe(date);
  });

  it("should validate and allow throwing EntityValidationError", () => {
    const entity = EstablishmentAnalytics.create({
      establishment_id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      date: new Date("2024-01-01T00:00:00.000Z"),
      avg_rating: 7,
    });

    expect(entity.notification.hasErrors()).toBe(true);
    expect(() => {
      if (entity.notification.hasErrors()) {
        throw new EntityValidationError(entity.notification.toJSON());
      }
    }).toThrow(EntityValidationError);
  });
});
