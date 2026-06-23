import { IDateTimeService } from "../date-time.service";
import { InvalidArgumentError } from "../errors/invalid-argument.error";
import { parseTimeToMinutes } from "../time.utils";
import { ValueObject } from "../value-object";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TimeRange = {
  start: string;
  end: string;
};

export type SpecialDay = {
  date: string;
  closed?: boolean;
  ranges?: TimeRange[];
};

export type VacationRange = {
  startDate: string;
  endDate: string;
};

export type DateTimeClosure = {
  startAt: string;
  endAt: string;
};

export type OperatingHoursProps = {
  timezone?: string;
  weekly?: Partial<Record<Weekday, TimeRange[]>> | Record<string, unknown>;
  specialDays?: SpecialDay[];
  vacations?: VacationRange[];
  closures?: DateTimeClosure[];
};

type NormalizedWeekly = Partial<Record<Weekday, TimeRange[]>>;

type ClosureInterval = {
  startMs: number;
  endMs: number;
};

export class OperatingHours extends ValueObject {
  readonly timezone: string;
  readonly weekly: NormalizedWeekly;
  readonly specialDays: SpecialDay[];
  readonly vacations: VacationRange[];
  readonly closures: DateTimeClosure[];

  private readonly closureIntervals: ClosureInterval[];
  private readonly vacationDateRanges: Array<{ start: string; end: string }>;
  private readonly specialDaysByDate: Map<string, SpecialDay>;

  constructor(props: OperatingHoursProps) {
    super();
    this.timezone = (props.timezone ?? "UTC").trim() || "UTC";
    this.weekly = OperatingHours.normalizeWeekly(props.weekly);
    this.specialDays = Array.isArray(props.specialDays)
      ? props.specialDays
      : [];
    this.vacations = Array.isArray(props.vacations) ? props.vacations : [];
    this.closures = Array.isArray(props.closures) ? props.closures : [];

    this.validate();

    this.closureIntervals = this.closures
      .map((c) => {
        const startMs = OperatingHours.parseUtcInstantToMs(c.startAt);
        const endMs = OperatingHours.parseUtcInstantToMs(c.endAt);
        return { startMs, endMs };
      })
      .sort((a, b) => a.startMs - b.startMs);

    this.vacationDateRanges = this.vacations
      .map((v) => ({ start: v.startDate, end: v.endDate }))
      .sort((a, b) => a.start.localeCompare(b.start));

    this.specialDaysByDate = new Map<string, SpecialDay>();
    for (const d of this.specialDays) {
      this.specialDaysByDate.set(d.date, d);
    }
  }

  isOpenAt(dateUtc: Date, dateTimeService?: IDateTimeService): boolean {
    if (!(dateUtc instanceof Date) || Number.isNaN(dateUtc.getTime())) {
      return false;
    }

    if (this.isClosedByDateTimeClosure(dateUtc.getTime())) {
      return false;
    }

    const dateKey = dateTimeService
      ? OperatingHours.safeLocalDateString(
          dateUtc,
          this.timezone,
          dateTimeService,
        )
      : OperatingHours.toUtcDateString(dateUtc);

    if (!dateKey) {
      return false;
    }

    if (this.isClosedByVacation(dateKey)) {
      return false;
    }

    const special = this.specialDaysByDate.get(dateKey);
    if (special) {
      if (special.closed === true) {
        return false;
      }
      const ranges = Array.isArray(special.ranges) ? special.ranges : [];
      const minutes = dateTimeService
        ? dateTimeService.getLocalMinutesSinceStartOfDay(dateUtc, this.timezone)
        : dateUtc.getUTCHours() * 60 + dateUtc.getUTCMinutes();
      return this.isOpenByRangesMinutes(minutes, ranges, true);
    }

    const minutes = dateTimeService
      ? dateTimeService.getLocalMinutesSinceStartOfDay(dateUtc, this.timezone)
      : dateUtc.getUTCHours() * 60 + dateUtc.getUTCMinutes();

    const weekday = dateTimeService
      ? (dateTimeService.getLocalWeekday(dateUtc, this.timezone) as Weekday)
      : (dateUtc.getUTCDay() as Weekday);

    const todayRanges = this.weekly[weekday] ?? [];
    if (this.isOpenByRangesMinutes(minutes, todayRanges, true)) {
      return true;
    }

    const prevDateUtc = dateTimeService
      ? dateTimeService.addDaysKeepingLocalTime(dateUtc, -1, this.timezone)
      : new Date(dateUtc.getTime() - 24 * 60 * 60 * 1000);

    const prevDateKey = dateTimeService
      ? OperatingHours.safeLocalDateString(
          prevDateUtc,
          this.timezone,
          dateTimeService,
        )
      : OperatingHours.toUtcDateString(prevDateUtc);

    if (!prevDateKey) {
      return false;
    }

    if (this.isClosedByVacation(prevDateKey)) {
      return false;
    }

    const prevSpecial = this.specialDaysByDate.get(prevDateKey);
    const prevRanges = prevSpecial
      ? prevSpecial.closed
        ? []
        : Array.isArray(prevSpecial.ranges)
          ? prevSpecial.ranges
          : []
      : (this.weekly[
          dateTimeService
            ? (dateTimeService.getLocalWeekday(
                prevDateUtc,
                this.timezone,
              ) as Weekday)
            : (prevDateUtc.getUTCDay() as Weekday)
        ] ?? []);

    return this.isOpenByRangesMinutes(minutes, prevRanges, false);
  }

  toJSON() {
    return {
      timezone: this.timezone,
      weekly: this.weekly,
      specialDays: this.specialDays,
      vacations: this.vacations,
      closures: this.closures,
    };
  }

  static fromJSON(json: any): OperatingHours {
    const legacy = OperatingHours.tryParseLegacy(json);
    if (legacy) {
      return new OperatingHours(legacy);
    }

    const props: OperatingHoursProps = {
      timezone: typeof json?.timezone === "string" ? json.timezone : undefined,
      weekly: json?.weekly,
      specialDays: json?.specialDays ?? json?.special_days ?? undefined,
      vacations: json?.vacations ?? json?.vacationRanges ?? [],
      closures: json?.closures ?? json?.dateTimeClosures ?? [],
    };

    return new OperatingHours(props);
  }

  private validate(): void {
    if (!OperatingHours.isValidTimezone(this.timezone)) {
      throw new InvalidOperatingHoursError("Invalid timezone");
    }

    for (const [k, ranges] of Object.entries(this.weekly)) {
      const weekday = Number(k);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        throw new InvalidOperatingHoursError("Invalid weekly weekday");
      }
      if (!Array.isArray(ranges)) {
        throw new InvalidOperatingHoursError("Invalid weekly ranges");
      }
      for (const range of ranges) {
        OperatingHours.parseTimeRange(range);
      }
    }

    const specialDates = new Set<string>();
    for (const d of this.specialDays) {
      if (!OperatingHours.isIsoDate(d?.date)) {
        throw new InvalidOperatingHoursError("Invalid special day date");
      }
      if (specialDates.has(d.date)) {
        throw new InvalidOperatingHoursError("Duplicate special day date");
      }
      specialDates.add(d.date);

      if (d.closed === true && Array.isArray(d.ranges) && d.ranges.length > 0) {
        throw new InvalidOperatingHoursError(
          "Special day cannot be closed and have ranges",
        );
      }

      if (d.closed !== true && d.ranges !== undefined) {
        if (!Array.isArray(d.ranges)) {
          throw new InvalidOperatingHoursError("Invalid special day ranges");
        }
        for (const r of d.ranges) {
          OperatingHours.parseTimeRange(r);
        }
      }
    }

    for (const v of this.vacations) {
      if (!OperatingHours.isIsoDate(v?.startDate)) {
        throw new InvalidOperatingHoursError("Invalid vacation startDate");
      }
      if (!OperatingHours.isIsoDate(v?.endDate)) {
        throw new InvalidOperatingHoursError("Invalid vacation endDate");
      }
      if (v.startDate > v.endDate) {
        throw new InvalidOperatingHoursError(
          "Vacation startDate cannot be after endDate",
        );
      }
    }

    for (const c of this.closures) {
      const startMs = OperatingHours.parseUtcInstantToMs(c?.startAt);
      const endMs = OperatingHours.parseUtcInstantToMs(c?.endAt);
      if (endMs <= startMs) {
        throw new InvalidOperatingHoursError(
          "Closure endAt must be after startAt",
        );
      }
    }
  }

  private isClosedByDateTimeClosure(dateUtcMs: number): boolean {
    for (const c of this.closureIntervals) {
      if (dateUtcMs >= c.startMs && dateUtcMs < c.endMs) {
        return true;
      }
    }
    return false;
  }

  private isClosedByVacation(dateKey: string): boolean {
    for (const v of this.vacationDateRanges) {
      if (dateKey >= v.start && dateKey <= v.end) {
        return true;
      }
    }
    return false;
  }

  private isOpenByRangesMinutes(
    minutes: number,
    ranges: TimeRange[],
    includeSameDayOvernight: boolean,
  ): boolean {
    for (const r of ranges) {
      const parsed = OperatingHours.parseTimeRange(r);
      const start = parsed.start;
      const end = parsed.end;

      if (end > start) {
        if (minutes >= start && minutes < end) {
          return true;
        }
        continue;
      }

      if (includeSameDayOvernight) {
        if (minutes >= start) {
          return true;
        }
      } else {
        if (minutes < end) {
          return true;
        }
      }
    }
    return false;
  }

  private static safeLocalDateString(
    dateUtc: Date,
    timezone: string,
    dateTimeService: IDateTimeService,
  ): string | null {
    try {
      return dateTimeService.toLocalDateString(dateUtc, timezone);
    } catch {
      return null;
    }
  }

  private static toUtcDateString(dateUtc: Date): string | null {
    try {
      return dateUtc.toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }

  private static isIsoDate(value: unknown): value is string {
    if (typeof value !== "string") {
      return false;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const ms = Date.parse(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(ms)) {
      return false;
    }
    return new Date(ms).toISOString().slice(0, 10) === value;
  }

  private static isValidTimezone(timezone: string): boolean {
    if (!timezone || typeof timezone !== "string") {
      return false;
    }
    const tz = timezone.trim();
    if (!tz) {
      return false;
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
      return true;
    } catch {
      return false;
    }
  }

  private static parseUtcInstantToMs(value: unknown): number {
    if (typeof value !== "string") {
      throw new InvalidOperatingHoursError("Invalid UTC datetime");
    }

    const v = value.trim();
    const isoWithTz =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
    if (!isoWithTz.test(v)) {
      throw new InvalidOperatingHoursError("Invalid UTC datetime");
    }

    const ms = Date.parse(v);
    if (!Number.isFinite(ms)) {
      throw new InvalidOperatingHoursError("Invalid UTC datetime");
    }

    return ms;
  }

  private static parseTimeRange(range: TimeRange): {
    start: number;
    end: number;
  } {
    if (!range || typeof range !== "object") {
      throw new InvalidOperatingHoursError("Invalid time range");
    }

    if (typeof range.start !== "string" || typeof range.end !== "string") {
      throw new InvalidOperatingHoursError("Invalid time range");
    }

    const start = parseTimeToMinutes(range.start);
    if (start < 0) {
      throw new InvalidOperatingHoursError("Invalid time");
    }

    const end = OperatingHours.parseEndTimeToMinutes(range.end);

    if (end < 0 || end > 24 * 60) {
      throw new InvalidOperatingHoursError("Invalid time");
    }

    if (end === start) {
      throw new InvalidOperatingHoursError("Invalid time range");
    }

    return { start, end };
  }

  private static parseEndTimeToMinutes(value: string): number {
    const v = value.trim();
    if (v === "24:00") {
      return 24 * 60;
    }
    return parseTimeToMinutes(v);
  }

  private static normalizeWeekly(
    weekly: OperatingHoursProps["weekly"],
  ): NormalizedWeekly {
    if (!weekly || typeof weekly !== "object" || Array.isArray(weekly)) {
      return {};
    }

    const normalized: NormalizedWeekly = {};

    for (const [key, value] of Object.entries(weekly as any)) {
      const k = String(key).trim();
      const asNumber = Number(k);
      const weekday = Number.isInteger(asNumber)
        ? asNumber
        : OperatingHours.legacyDayNameToWeekday(k);
      if (weekday === null) {
        continue;
      }

      if (!Array.isArray(value)) {
        continue;
      }

      normalized[weekday as Weekday] = value
        .filter((r: any) => r && typeof r === "object")
        .map((r: any) => ({ start: r.start, end: r.end }));
    }

    return normalized;
  }

  private static legacyDayNameToWeekday(value: string): Weekday | null {
    const v = value.toLowerCase();
    if (["sun", "sunday", "dom", "domingo"].includes(v)) return 0;
    if (["mon", "monday", "seg", "segunda"].includes(v)) return 1;
    if (["tue", "tuesday", "ter", "terça", "terca"].includes(v)) return 2;
    if (["wed", "wednesday", "qua", "quarta"].includes(v)) return 3;
    if (["thu", "thursday", "qui", "quinta"].includes(v)) return 4;
    if (["fri", "friday", "sex", "sexta"].includes(v)) return 5;
    if (["sat", "saturday", "sab", "sábado", "sabado"].includes(v)) return 6;
    return null;
  }

  private static tryParseLegacy(json: any): OperatingHoursProps | null {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      return null;
    }

    const hasNewKeys =
      "weekly" in json ||
      "timezone" in json ||
      "specialDays" in json ||
      "special_days" in json ||
      "vacations" in json ||
      "closures" in json;

    if (hasNewKeys) {
      return null;
    }

    const weekly: NormalizedWeekly = {};

    for (const [rawDay, rawValue] of Object.entries(json)) {
      const weekday = OperatingHours.legacyDayNameToWeekday(String(rawDay));
      if (weekday === null) {
        continue;
      }

      const ranges: TimeRange[] = [];

      if (typeof rawValue === "string") {
        const parsed = OperatingHours.parseLegacyRangeString(rawValue);
        if (parsed) {
          ranges.push(parsed);
        }
      } else if (Array.isArray(rawValue)) {
        for (const item of rawValue) {
          if (typeof item === "string") {
            const parsed = OperatingHours.parseLegacyRangeString(item);
            if (parsed) {
              ranges.push(parsed);
            }
          }
        }
      } else if (
        rawValue &&
        typeof rawValue === "object" &&
        !Array.isArray(rawValue)
      ) {
        const open = (rawValue as any).open;
        const close = (rawValue as any).close;
        if (typeof open === "string" && typeof close === "string") {
          ranges.push({ start: open, end: close });
        }
      }

      if (ranges.length > 0) {
        weekly[weekday] = ranges;
      }
    }

    return {
      timezone: "UTC",
      weekly,
      specialDays: [],
      vacations: [],
      closures: [],
    };
  }

  private static parseLegacyRangeString(value: string): TimeRange | null {
    const v = value.trim();
    const parts = v.split("-").map((p) => p.trim());
    if (parts.length !== 2) {
      return null;
    }
    const normalizedStart = OperatingHours.normalizeLegacyTime(parts[0]);
    const normalizedEnd = OperatingHours.normalizeLegacyTime(parts[1]);
    if (!normalizedStart || !normalizedEnd) {
      return null;
    }
    return { start: normalizedStart, end: normalizedEnd };
  }

  private static normalizeLegacyTime(value: string): string | null {
    const v = value.trim();
    const hhmm = /^(\d{1,2})(?::(\d{2}))?$/;
    const match = hhmm.exec(v);
    if (!match) {
      return null;
    }
    const h = Number(match[1]);
    const m = match[2] ? Number(match[2]) : 0;
    if (!Number.isInteger(h) || !Number.isInteger(m)) {
      return null;
    }
    if (h < 0 || h > 24) {
      return null;
    }
    if (m < 0 || m > 59) {
      return null;
    }
    if (h === 24 && m !== 0) {
      return null;
    }
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
}

export class InvalidOperatingHoursError extends InvalidArgumentError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOperatingHoursError";
  }
}
