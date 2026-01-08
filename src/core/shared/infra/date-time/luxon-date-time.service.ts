import { DateTime } from "luxon";

import {
  IDateTimeService,
  LocalDate,
  LocalTime,
  Timezone,
  UtcRange,
} from "../../domain";

export class LuxonDateTimeService implements IDateTimeService {
  isValidTimezone(timezone: Timezone): boolean {
    if (!timezone || typeof timezone !== "string") {
      return false;
    }
    return DateTime.now().setZone(timezone).isValid;
  }

  getUtcRangeForMonth(input: {
    year: number;
    month: number;
    timezone: Timezone;
  }): UtcRange {
    const { year, month, timezone } = input;

    const tz = this.normalizeTimezone(timezone);
    const startLocal = DateTime.fromObject(
      { year, month, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 },
      { zone: tz },
    ).startOf("day");

    if (!startLocal.isValid) {
      throw new Error("Invalid month range");
    }

    const endLocal = startLocal.plus({ months: 1 }).startOf("day");

    return {
      start_at: startLocal.toUTC().toJSDate(),
      end_at: endLocal.toUTC().toJSDate(),
    };
  }

  toLocalDateString(dateUtc: Date, timezone: Timezone): string {
    const tz = this.normalizeTimezone(timezone);
    const dt = DateTime.fromJSDate(dateUtc, { zone: "utc" }).setZone(tz);
    if (!dt.isValid) {
      throw new Error("Invalid date/time");
    }
    const isoDate = dt.toISODate();
    if (!isoDate) {
      throw new Error("Invalid date/time");
    }
    return isoDate;
  }

  getLocalWeekday(dateUtc: Date, timezone: Timezone): number {
    const tz = this.normalizeTimezone(timezone);
    const dt = DateTime.fromJSDate(dateUtc, { zone: "utc" }).setZone(tz);
    if (!dt.isValid) {
      throw new Error("Invalid date/time");
    }
    return dt.weekday % 7;
  }

  getLocalMinutesSinceStartOfDay(dateUtc: Date, timezone: Timezone): number {
    const tz = this.normalizeTimezone(timezone);
    const dt = DateTime.fromJSDate(dateUtc, { zone: "utc" }).setZone(tz);
    if (!dt.isValid) {
      throw new Error("Invalid date/time");
    }
    return dt.hour * 60 + dt.minute;
  }

  fromLocalDateTime(input: {
    date: LocalDate;
    time: LocalTime;
    timezone: Timezone;
  }): Date | null {
    const tz = this.normalizeTimezone(input.timezone);

    const dt = DateTime.fromObject(
      {
        year: input.date.year,
        month: input.date.month,
        day: input.date.day,
        hour: input.time.hour,
        minute: input.time.minute,
        second: input.time.second ?? 0,
        millisecond: input.time.millisecond ?? 0,
      },
      { zone: tz },
    );

    if (!dt.isValid) {
      return null;
    }

    return dt.toUTC().toJSDate();
  }

  addMinutes(dateUtc: Date, minutes: number): Date {
    return new Date(dateUtc.getTime() + minutes * 60 * 1000);
  }

  addHours(dateUtc: Date, hours: number): Date {
    return new Date(dateUtc.getTime() + hours * 60 * 60 * 1000);
  }

  addDaysKeepingLocalTime(
    dateUtc: Date,
    days: number,
    timezone: Timezone,
  ): Date {
    const tz = this.normalizeTimezone(timezone);
    const dt = DateTime.fromJSDate(dateUtc, { zone: "utc" }).setZone(tz);
    if (!dt.isValid) {
      throw new Error("Invalid date/time");
    }
    return dt.plus({ days }).toUTC().toJSDate();
  }

  private normalizeTimezone(timezone: Timezone): Timezone {
    const tz = timezone?.trim?.() || "UTC";
    if (!this.isValidTimezone(tz)) {
      return "UTC";
    }
    return tz;
  }
}
