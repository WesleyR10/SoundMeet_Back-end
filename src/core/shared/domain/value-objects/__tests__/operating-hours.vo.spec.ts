import { LuxonDateTimeService } from "../../../infra/date-time/luxon-date-time.service";
import { InvariantViolationError } from "../../errors/invariant-violation.error";
import { OperatingHours } from "../operating-hours.vo";

describe("OperatingHours Value Object Unit Tests", () => {
  const dateTimeService = new LuxonDateTimeService();

  const toUtc = (input: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    timezone: string;
  }) => {
    const dateUtc = dateTimeService.fromLocalDateTime({
      date: { year: input.year, month: input.month, day: input.day },
      time: { hour: input.hour, minute: input.minute },
      timezone: input.timezone,
    });
    if (!dateUtc) {
      throw new InvariantViolationError("Invalid test date/time");
    }
    return dateUtc;
  };

  it("should reject invalid timezone", () => {
    expect(
      () =>
        new OperatingHours({
          timezone: "Invalid/Timezone",
          weekly: { 1: [{ start: "10:00", end: "18:00" }] },
        }),
    ).toThrow("Invalid timezone");
  });

  it("should parse legacy weekly object", () => {
    const oh = OperatingHours.fromJSON({ mon: "10-18" });
    expect(oh.toJSON()).toEqual({
      timezone: "UTC",
      weekly: {
        1: [{ start: "10:00", end: "18:00" }],
      },
      specialDays: [],
      vacations: [],
      closures: [],
    });
  });

  it("should treat overnight ranges as open after midnight", () => {
    const tz = "America/Sao_Paulo";
    const oh = new OperatingHours({
      timezone: tz,
      weekly: {
        1: [{ start: "20:00", end: "02:00" }],
      },
    });

    const mondayAt21Local = toUtc({
      year: 2026,
      month: 1,
      day: 5,
      hour: 21,
      minute: 0,
      timezone: tz,
    });
    expect(oh.isOpenAt(mondayAt21Local, dateTimeService)).toBe(true);

    const tuesdayAt01Local = toUtc({
      year: 2026,
      month: 1,
      day: 6,
      hour: 1,
      minute: 0,
      timezone: tz,
    });
    expect(oh.isOpenAt(tuesdayAt01Local, dateTimeService)).toBe(true);

    const tuesdayAt03Local = toUtc({
      year: 2026,
      month: 1,
      day: 6,
      hour: 3,
      minute: 0,
      timezone: tz,
    });
    expect(oh.isOpenAt(tuesdayAt03Local, dateTimeService)).toBe(false);
  });

  it("should close during vacations and closures", () => {
    const tz = "America/Sao_Paulo";
    const closureStartUtc = toUtc({
      year: 2026,
      month: 1,
      day: 5,
      hour: 22,
      minute: 0,
      timezone: tz,
    });
    const closureEndUtc = toUtc({
      year: 2026,
      month: 1,
      day: 5,
      hour: 23,
      minute: 0,
      timezone: tz,
    });

    const oh = new OperatingHours({
      timezone: tz,
      weekly: {
        1: [{ start: "20:00", end: "02:00" }],
      },
      vacations: [{ startDate: "2026-01-05", endDate: "2026-01-06" }],
      closures: [
        {
          startAt: closureStartUtc.toISOString(),
          endAt: closureEndUtc.toISOString(),
        },
      ],
    });

    const mondayAt2130Local = toUtc({
      year: 2026,
      month: 1,
      day: 5,
      hour: 21,
      minute: 30,
      timezone: tz,
    });
    expect(oh.isOpenAt(mondayAt2130Local, dateTimeService)).toBe(false);

    const mondayAt2230Local = toUtc({
      year: 2026,
      month: 1,
      day: 5,
      hour: 22,
      minute: 30,
      timezone: tz,
    });
    expect(oh.isOpenAt(mondayAt2230Local, dateTimeService)).toBe(false);
  });

  it("should prioritize special days over weekly", () => {
    const tz = "America/Sao_Paulo";
    const oh = new OperatingHours({
      timezone: tz,
      weekly: {
        1: [{ start: "10:00", end: "23:00" }],
      },
      specialDays: [
        {
          date: "2026-01-05",
          ranges: [{ start: "12:00", end: "13:00" }],
        },
      ],
    });

    const mondayAt1130Local = toUtc({
      year: 2026,
      month: 1,
      day: 5,
      hour: 11,
      minute: 30,
      timezone: tz,
    });
    expect(oh.isOpenAt(mondayAt1130Local, dateTimeService)).toBe(false);

    const mondayAt1230Local = toUtc({
      year: 2026,
      month: 1,
      day: 5,
      hour: 12,
      minute: 30,
      timezone: tz,
    });
    expect(oh.isOpenAt(mondayAt1230Local, dateTimeService)).toBe(true);
  });
});
