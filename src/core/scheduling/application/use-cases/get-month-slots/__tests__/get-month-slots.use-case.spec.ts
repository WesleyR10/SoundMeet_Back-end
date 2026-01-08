import { LuxonDateTimeService } from "../../../../../shared/infra/date-time/luxon-date-time.service";
import { ICalendarReadModel } from "../../../gateways/calendar-read-model.interface";
import { GetMonthSlotsUseCase } from "../get-month-slots.use-case";

describe("GetMonthSlotsUseCase Unit Tests", () => {
  test("should generate slots based on weekly rules excluding busy intervals", async () => {
    const dateTimeService = new LuxonDateTimeService();
    const readModel: ICalendarReadModel = {
      async getSettings() {
        return {
          timezone: "UTC",
          default_buffer_minutes: 0,
          max_shows_per_day: null,
          is_active: true,
          weekly_rules: [
            {
              weekday: 1,
              start_time: "10:00",
              end_time: "11:00",
              is_available: true,
            },
          ],
          unavailabilities: [
            {
              start_at: new Date("2024-01-01T10:30:00.000Z"),
              end_at: new Date("2024-01-01T11:00:00.000Z"),
              reason: "break",
            },
          ],
        };
      },
      async getBookingsInRange() {
        return [];
      },
    };

    const useCase = new GetMonthSlotsUseCase(readModel, dateTimeService);
    const output = await useCase.execute({
      target_type: "musician",
      target_id: "c0a801f1-5f1d-4f0c-9fd6-9a30f9d3f9c3",
      year: 2024,
      month: 1,
      slot_minutes: 30,
    });

    const day = output.days.find((d) => d.date === "2024-01-01");
    expect(day).toBeTruthy();
    expect(day!.slots).toHaveLength(1);
    expect(day!.slots[0].start_at.toISOString()).toBe(
      "2024-01-01T10:00:00.000Z",
    );
    expect(day!.slots[0].end_at.toISOString()).toBe("2024-01-01T10:30:00.000Z");
  });

  test("should generate slots using target timezone", async () => {
    const dateTimeService = new LuxonDateTimeService();
    const readModel: ICalendarReadModel = {
      async getSettings() {
        return {
          timezone: "America/Sao_Paulo",
          default_buffer_minutes: 0,
          max_shows_per_day: null,
          is_active: true,
          weekly_rules: [
            {
              weekday: 1,
              start_time: "10:00",
              end_time: "11:00",
              is_available: true,
            },
          ],
          unavailabilities: [],
        };
      },
      async getBookingsInRange() {
        return [];
      },
    };

    const useCase = new GetMonthSlotsUseCase(readModel, dateTimeService);
    const output = await useCase.execute({
      target_type: "musician",
      target_id: "c0a801f1-5f1d-4f0c-9fd6-9a30f9d3f9c3",
      year: 2024,
      month: 1,
      slot_minutes: 60,
    });

    const day = output.days.find((d) => d.date === "2024-01-01");
    expect(day).toBeTruthy();
    expect(day!.slots).toHaveLength(1);
    expect(day!.slots[0].start_at.toISOString()).toBe(
      "2024-01-01T13:00:00.000Z",
    );
    expect(day!.slots[0].end_at.toISOString()).toBe("2024-01-01T14:00:00.000Z");
  });

  test("should generate slots for band target", async () => {
    const dateTimeService = new LuxonDateTimeService();
    const readModel: ICalendarReadModel = {
      async getSettings() {
        return {
          timezone: "UTC",
          default_buffer_minutes: 0,
          max_shows_per_day: null,
          is_active: true,
          weekly_rules: [
            {
              weekday: 1,
              start_time: "10:00",
              end_time: "11:00",
              is_available: true,
            },
          ],
          unavailabilities: [],
        };
      },
      async getBookingsInRange() {
        return [];
      },
    };

    const useCase = new GetMonthSlotsUseCase(readModel, dateTimeService);
    const output = await useCase.execute({
      target_type: "band",
      target_id: "c0a801f1-5f1d-4f0c-9fd6-9a30f9d3f9c3",
      year: 2024,
      month: 1,
      slot_minutes: 60,
    });

    const day = output.days.find((d) => d.date === "2024-01-01");
    expect(day).toBeTruthy();
    expect(day!.slots).toHaveLength(1);
    expect(day!.slots[0].start_at.toISOString()).toBe(
      "2024-01-01T10:00:00.000Z",
    );
    expect(day!.slots[0].end_at.toISOString()).toBe("2024-01-01T11:00:00.000Z");
  });
});
