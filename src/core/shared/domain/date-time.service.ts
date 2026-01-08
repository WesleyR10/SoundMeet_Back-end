export type Timezone = string;

export type LocalDate = {
  year: number;
  month: number;
  day: number;
};

export type LocalTime = {
  hour: number;
  minute: number;
  second?: number;
  millisecond?: number;
};

export type UtcRange = {
  start_at: Date;
  end_at: Date;
};

export interface IDateTimeService {
  isValidTimezone(timezone: Timezone): boolean;

  getUtcRangeForMonth(input: {
    year: number;
    month: number;
    timezone: Timezone;
  }): UtcRange;

  toLocalDateString(dateUtc: Date, timezone: Timezone): string;
  getLocalWeekday(dateUtc: Date, timezone: Timezone): number;
  getLocalMinutesSinceStartOfDay(dateUtc: Date, timezone: Timezone): number;

  fromLocalDateTime(input: {
    date: LocalDate;
    time: LocalTime;
    timezone: Timezone;
  }): Date | null;

  addMinutes(dateUtc: Date, minutes: number): Date;
  addHours(dateUtc: Date, hours: number): Date;
  addDaysKeepingLocalTime(
    dateUtc: Date,
    days: number,
    timezone: Timezone,
  ): Date;
}
