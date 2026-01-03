export type CalendarTarget =
  | { type: "musician"; id: string }
  | { type: "band"; id: string };

export type WeeklyRule = {
  weekday: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
};

export type UnavailabilityReadModel = {
  start_at: Date;
  end_at: Date;
  reason: string | null;
};

export type BookingReadModel = {
  id: string;
  start_at: Date;
  end_at: Date;
  buffer_minutes: number;
  status: string;
};

export type CalendarSettingsReadModel = {
  timezone: string;
  default_buffer_minutes: number;
  max_shows_per_day: number | null;
  is_active: boolean;
  weekly_rules: WeeklyRule[];
  unavailabilities: UnavailabilityReadModel[];
};

export interface ICalendarReadModel {
  getSettings(target: CalendarTarget): Promise<CalendarSettingsReadModel>;
  getBookingsInRange(
    target: CalendarTarget,
    range: { start_at: Date; end_at: Date },
    statuses?: string[],
  ): Promise<BookingReadModel[]>;
}
