import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { LuxonDateTimeService } from "../../../shared/infra/date-time/luxon-date-time.service";
import { Availability } from "../availability.aggregate";

describe("Availability Unit Tests", () => {
  test("should create availability with musician target", () => {
    const availability = Availability.create({
      musician_id: new Uuid().id,
      is_active: true,
    });
    expect(availability.musician_id).not.toBeNull();
    expect(availability.band_id).toBeNull();
  });

  test("should throw EntityValidationError when both musician and band are set", () => {
    const availability = Availability.create({
      musician_id: new Uuid().id,
      band_id: new Uuid().id,
    });
    expect(availability.notification.hasErrors()).toBe(true);
  });

  test("should detect unavailability overlap", () => {
    const availability = Availability.create({
      musician_id: new Uuid().id,
      unavailabilities: [
        {
          start_at: new Date("2024-01-01T10:00:00.000Z"),
          end_at: new Date("2024-01-01T11:00:00.000Z"),
        },
        {
          start_at: new Date("2024-01-01T10:30:00.000Z"),
          end_at: new Date("2024-01-01T12:00:00.000Z"),
        },
      ],
    });
    expect(availability.notification.hasErrors()).toBe(true);
  });

  test("isAvailable should return false when intersects unavailability", () => {
    const availability = Availability.create({
      musician_id: new Uuid().id,
      unavailabilities: [
        {
          start_at: new Date("2024-01-01T10:00:00.000Z"),
          end_at: new Date("2024-01-01T11:00:00.000Z"),
        },
      ],
    });

    expect(
      availability.isAvailable(
        new Date("2024-01-01T10:30:00.000Z"),
        new Date("2024-01-01T10:45:00.000Z"),
      ),
    ).toBe(false);
  });

  test("isAvailable should consider weekly rules when provided", () => {
    const dateTimeService = new LuxonDateTimeService();
    const availability = Availability.create({
      musician_id: new Uuid().id,
      weekly_rules: [
        { weekday: 1, start_time: "10:00", end_time: "12:00" },
        { weekday: 2, start_time: "10:00", end_time: "12:00" },
      ],
    });

    expect(
      availability.isAvailable(
        new Date("2024-01-01T10:30:00.000Z"),
        new Date("2024-01-01T11:00:00.000Z"),
        dateTimeService,
      ),
    ).toBe(true);

    expect(
      availability.isAvailable(
        new Date("2024-01-01T09:30:00.000Z"),
        new Date("2024-01-01T11:00:00.000Z"),
        dateTimeService,
      ),
    ).toBe(false);

    expect(
      availability.isAvailable(
        new Date("2024-01-03T10:30:00.000Z"),
        new Date("2024-01-03T11:00:00.000Z"),
        dateTimeService,
      ),
    ).toBe(false);
  });

  test("weekly rules should be evaluated using availability timezone", () => {
    const dateTimeService = new LuxonDateTimeService();
    const availability = Availability.create({
      musician_id: new Uuid().id,
      timezone: "America/Sao_Paulo",
      weekly_rules: [{ weekday: 0, start_time: "22:00", end_time: "23:00" }],
    });

    expect(
      availability.isAvailable(
        new Date("2024-01-01T01:00:00.000Z"),
        new Date("2024-01-01T01:30:00.000Z"),
        dateTimeService,
      ),
    ).toBe(true);
  });

  test("isAvailable should consider weekly rules for band when provided", () => {
    const dateTimeService = new LuxonDateTimeService();
    const availability = Availability.create({
      band_id: new Uuid().id,
      weekly_rules: [
        { weekday: 1, start_time: "10:00", end_time: "12:00" },
        { weekday: 2, start_time: "10:00", end_time: "12:00" },
      ],
    });

    expect(
      availability.isAvailable(
        new Date("2024-01-01T10:30:00.000Z"),
        new Date("2024-01-01T11:00:00.000Z"),
        dateTimeService,
      ),
    ).toBe(true);

    expect(
      availability.isAvailable(
        new Date("2024-01-01T09:30:00.000Z"),
        new Date("2024-01-01T11:00:00.000Z"),
        dateTimeService,
      ),
    ).toBe(false);

    expect(
      availability.isAvailable(
        new Date("2024-01-03T10:30:00.000Z"),
        new Date("2024-01-03T11:00:00.000Z"),
        dateTimeService,
      ),
    ).toBe(false);
  });
});
