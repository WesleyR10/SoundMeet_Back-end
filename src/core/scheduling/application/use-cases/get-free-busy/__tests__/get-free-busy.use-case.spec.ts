import { ICalendarReadModel } from "../../../gateways/calendar-read-model.interface";
import { GetFreeBusyUseCase } from "../get-free-busy.use-case";

describe("GetFreeBusyUseCase Unit Tests", () => {
  test("should merge busy intervals from bookings and unavailabilities", async () => {
    const readModel: ICalendarReadModel = {
      async getSettings() {
        return {
          timezone: "UTC",
          default_buffer_minutes: 0,
          max_shows_per_day: null,
          is_active: true,
          weekly_rules: [],
          unavailabilities: [
            {
              start_at: new Date("2024-01-01T10:15:00.000Z"),
              end_at: new Date("2024-01-01T10:45:00.000Z"),
              reason: "break",
            },
          ],
        };
      },
      async getBookingsInRange() {
        return [
          {
            id: "b1",
            start_at: new Date("2024-01-01T10:00:00.000Z"),
            end_at: new Date("2024-01-01T11:00:00.000Z"),
            buffer_minutes: 0,
            status: "confirmed",
          },
        ];
      },
    };

    const useCase = new GetFreeBusyUseCase(readModel);
    const output = await useCase.execute({
      target_type: "musician",
      target_id: "c0a801f1-5f1d-4f0c-9fd6-9a30f9d3f9c3",
      start_at: new Date("2024-01-01T09:00:00.000Z"),
      end_at: new Date("2024-01-01T12:00:00.000Z"),
    });

    expect(output.busy).toHaveLength(1);
    expect(output.busy[0]).toMatchObject({
      kind: "unavailability",
    });
    expect(output.busy[0].start_at.toISOString()).toBe(
      "2024-01-01T10:00:00.000Z",
    );
    expect(output.busy[0].end_at.toISOString()).toBe(
      "2024-01-01T11:00:00.000Z",
    );
  });

  test("should return full range busy when calendar is inactive", async () => {
    const readModel: ICalendarReadModel = {
      async getSettings() {
        return {
          timezone: "UTC",
          default_buffer_minutes: 0,
          max_shows_per_day: null,
          is_active: false,
          weekly_rules: [],
          unavailabilities: [],
        };
      },
      async getBookingsInRange() {
        return [];
      },
    };

    const useCase = new GetFreeBusyUseCase(readModel);
    const output = await useCase.execute({
      target_type: "band",
      target_id: "c0a801f1-5f1d-4f0c-9fd6-9a30f9d3f9c3",
      start_at: new Date("2024-01-01T09:00:00.000Z"),
      end_at: new Date("2024-01-01T12:00:00.000Z"),
    });

    expect(output.busy).toEqual([
      expect.objectContaining({
        start_at: new Date("2024-01-01T09:00:00.000Z"),
        end_at: new Date("2024-01-01T12:00:00.000Z"),
      }),
    ]);
  });
});
