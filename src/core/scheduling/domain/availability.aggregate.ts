import { AggregateRoot, Uuid } from "../../shared/domain";
import { ValueObject } from "../../shared/domain/value-object";
import { AvailabilityValidatorFactory } from "./availability.validator";
import { AvailabilityFakeBuilder } from "./availability-fake.builder";

export class AvailabilityId extends Uuid {}

export type UnavailabilityConstructorProps = {
  id?: Uuid;
  start_at: Date;
  end_at: Date;
  reason?: string | null;
  created_at?: Date;
};

export type AvailabilityConstructorProps = {
  id?: AvailabilityId;
  musician_id?: string | null;
  band_id?: string | null;
  timezone?: string;
  default_buffer_minutes?: number;
  max_shows_per_day?: number | null;
  weekly_rules?: AvailabilityRuleConstructorProps[];
  unavailabilities?: UnavailabilityConstructorProps[];
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export type AvailabilityCreateCommand = {
  musician_id?: string | null;
  band_id?: string | null;
  timezone?: string;
  default_buffer_minutes?: number;
  max_shows_per_day?: number | null;
  weekly_rules?: Array<{
    weekday: number;
    start_time: string;
    end_time: string;
    is_available?: boolean;
  }>;
  unavailabilities?: Array<{
    start_at: Date;
    end_at: Date;
    reason?: string | null;
  }>;
  is_active?: boolean;
};

export type Unavailability = {
  id: Uuid;
  start_at: Date;
  end_at: Date;
  reason: string | null;
  created_at: Date;
};

export type AvailabilityRuleConstructorProps = {
  id?: Uuid;
  weekday: number;
  start_time: string;
  end_time: string;
  is_available?: boolean;
  created_at?: Date;
};

export type AvailabilityRule = {
  id: Uuid;
  weekday: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: Date;
};

export class Availability extends AggregateRoot {
  id: AvailabilityId;
  musician_id: Uuid | null;
  band_id: Uuid | null;
  timezone: string;
  default_buffer_minutes: number;
  max_shows_per_day: number | null;
  weekly_rules: AvailabilityRule[];
  unavailabilities: Unavailability[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: AvailabilityConstructorProps) {
    super();
    this.id = props.id ?? new AvailabilityId();
    this.musician_id = props.musician_id ? new Uuid(props.musician_id) : null;
    this.band_id = props.band_id ? new Uuid(props.band_id) : null;
    this.timezone = props.timezone ?? "UTC";
    this.default_buffer_minutes = props.default_buffer_minutes ?? 0;
    this.max_shows_per_day = props.max_shows_per_day ?? null;
    this.weekly_rules = (props.weekly_rules ?? []).map((r) => ({
      id: r.id ?? new Uuid(),
      weekday: r.weekday,
      start_time: r.start_time,
      end_time: r.end_time,
      is_available: r.is_available ?? true,
      created_at: r.created_at ?? new Date(),
    }));
    this.unavailabilities = (props.unavailabilities ?? []).map((u) => ({
      id: u.id ?? new Uuid(),
      start_at: u.start_at,
      end_at: u.end_at,
      reason: u.reason ?? null,
      created_at: u.created_at ?? new Date(),
    }));
    this.is_active = props.is_active ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): ValueObject {
    return this.id;
  }

  static create(props: AvailabilityCreateCommand): Availability {
    const entity = new Availability({
      musician_id: props.musician_id,
      band_id: props.band_id,
      timezone: props.timezone,
      default_buffer_minutes: props.default_buffer_minutes,
      max_shows_per_day: props.max_shows_per_day,
      weekly_rules: (props.weekly_rules ?? []).map((r) => ({
        weekday: r.weekday,
        start_time: r.start_time,
        end_time: r.end_time,
        is_available: r.is_available ?? true,
      })),
      unavailabilities: (props.unavailabilities ?? []).map((u) => ({
        start_at: u.start_at,
        end_at: u.end_at,
        reason: u.reason ?? null,
      })),
      is_active: props.is_active,
    });
    entity.validate();
    return entity;
  }

  updateSettings(props: {
    timezone?: string;
    default_buffer_minutes?: number;
    max_shows_per_day?: number | null;
  }): void {
    if (typeof props.timezone === "string") {
      this.timezone = props.timezone;
    }
    if (typeof props.default_buffer_minutes === "number") {
      this.default_buffer_minutes = props.default_buffer_minutes;
    }
    if (props.max_shows_per_day !== undefined) {
      this.max_shows_per_day = props.max_shows_per_day;
    }
    this.updated_at = new Date();
    this.validate(["timezone", "default_buffer_minutes", "max_shows_per_day"]);
  }

  setWeeklyRules(
    rules: Array<{
      weekday: number;
      start_time: string;
      end_time: string;
      is_available?: boolean;
    }>,
  ): void {
    this.weekly_rules = rules.map((r) => ({
      id: new Uuid(),
      weekday: r.weekday,
      start_time: r.start_time,
      end_time: r.end_time,
      is_available: r.is_available ?? true,
      created_at: new Date(),
    }));
    this.updated_at = new Date();
    this.validate();
  }

  addUnavailability(
    start_at: Date,
    end_at: Date,
    reason?: string | null,
  ): Uuid {
    const unavailabilityId = new Uuid();
    this.unavailabilities.push({
      id: unavailabilityId,
      start_at,
      end_at,
      reason: reason ?? null,
      created_at: new Date(),
    });
    this.updated_at = new Date();
    this.validate();
    return unavailabilityId;
  }

  removeUnavailability(unavailability_id: string | Uuid): void {
    const id =
      unavailability_id instanceof Uuid
        ? unavailability_id
        : new Uuid(unavailability_id);
    const initialLength = this.unavailabilities.length;
    this.unavailabilities = this.unavailabilities.filter(
      (u) => !u.id.equals(id),
    );
    if (this.unavailabilities.length === initialLength) {
      this.notification.addError(
        "Unavailability not found",
        "unavailability_id",
      );
      return;
    }
    this.updated_at = new Date();
  }

  isAvailable(start_at: Date, end_at: Date): boolean {
    if (!this.is_active) {
      return false;
    }

    if (this.weekly_rules.length) {
      if (!this.isAllowedByWeeklyRules(start_at, end_at)) {
        return false;
      }
    }

    const start = start_at.getTime();
    const end = end_at.getTime();
    return !this.unavailabilities.some((u) => {
      const uStart = u.start_at.getTime();
      const uEnd = u.end_at.getTime();
      return start < uEnd && uStart < end;
    });
  }

  private isAllowedByWeeklyRules(start_at: Date, end_at: Date): boolean {
    const startDayKey = Availability.getDayKeyUTC(start_at);
    const endDayKey = Availability.getDayKeyUTC(end_at);

    for (let dayKey = startDayKey; dayKey <= endDayKey; dayKey++) {
      const dayStart = Availability.dayKeyToUTCStart(dayKey);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const segmentStart =
        start_at.getTime() > dayStart.getTime() ? start_at : dayStart;
      const segmentEnd = end_at.getTime() < dayEnd.getTime() ? end_at : dayEnd;

      if (segmentStart.getTime() >= segmentEnd.getTime()) {
        continue;
      }

      const weekday = segmentStart.getUTCDay();
      const rulesForDay = this.weekly_rules.filter(
        (r) => r.weekday === weekday,
      );
      if (!rulesForDay.length) {
        return false;
      }

      const segmentStartMinutes =
        segmentStart.getUTCHours() * 60 + segmentStart.getUTCMinutes();
      const segmentEndMinutes =
        segmentEnd.getUTCHours() * 60 + segmentEnd.getUTCMinutes();

      const availableRules = rulesForDay.filter((r) => r.is_available);
      const unavailableRules = rulesForDay.filter((r) => !r.is_available);

      const isInsideSomeAvailable = availableRules.some((r) => {
        const rStart = Availability.parseTimeToMinutes(r.start_time);
        const rEnd = Availability.parseTimeToMinutes(r.end_time);
        return rStart <= segmentStartMinutes && segmentEndMinutes <= rEnd;
      });

      if (!isInsideSomeAvailable) {
        return false;
      }

      const hitsUnavailable = unavailableRules.some((r) => {
        const rStart = Availability.parseTimeToMinutes(r.start_time);
        const rEnd = Availability.parseTimeToMinutes(r.end_time);
        return segmentStartMinutes < rEnd && rStart < segmentEndMinutes;
      });

      if (hitsUnavailable) {
        return false;
      }
    }

    return true;
  }

  private static getDayKeyUTC(date: Date): number {
    const utcMidnight = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    );
    return Math.floor(utcMidnight / (24 * 60 * 60 * 1000));
  }

  private static dayKeyToUTCStart(dayKey: number): Date {
    return new Date(dayKey * 24 * 60 * 60 * 1000);
  }

  private static parseTimeToMinutes(value: string): number {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) {
      return -1;
    }
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (
      Number.isNaN(h) ||
      Number.isNaN(m) ||
      h < 0 ||
      h > 23 ||
      m < 0 ||
      m > 59
    ) {
      return -1;
    }
    return h * 60 + m;
  }

  validate(fields?: string[]): boolean {
    const validator = AvailabilityValidatorFactory.create();
    validator.validate(this.notification, this, fields);

    const hasMusician = this.musician_id !== null;
    const hasBand = this.band_id !== null;
    if (hasMusician === hasBand) {
      this.notification.addError(
        "Either musician_id or band_id must be provided (exclusively)",
        "target",
      );
    }

    if (hasBand && this.weekly_rules.length) {
      this.notification.addError(
        "weekly_rules is only supported for musician availability",
        "weekly_rules",
      );
    }

    if (this.default_buffer_minutes < 0) {
      this.notification.addError(
        "default_buffer_minutes must be greater or equal to 0",
        "default_buffer_minutes",
      );
    }

    for (const [index, u] of this.unavailabilities.entries()) {
      if (u.end_at.getTime() <= u.start_at.getTime()) {
        this.notification.addError(
          "end_at must be greater than start_at",
          `unavailabilities[${index}].end_at`,
        );
      }
    }

    const sorted = [...this.unavailabilities].sort(
      (a, b) => a.start_at.getTime() - b.start_at.getTime(),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (
        prev.start_at.getTime() < curr.end_at.getTime() &&
        curr.start_at.getTime() < prev.end_at.getTime()
      ) {
        this.notification.addError(
          "Unavailability ranges cannot overlap",
          "unavailabilities",
        );
        break;
      }
    }

    for (const [index, r] of this.weekly_rules.entries()) {
      if (r.weekday < 0 || r.weekday > 6) {
        this.notification.addError(
          "weekday must be between 0 and 6",
          `weekly_rules[${index}].weekday`,
        );
        continue;
      }
      const startMinutes = Availability.parseTimeToMinutes(r.start_time);
      const endMinutes = Availability.parseTimeToMinutes(r.end_time);
      if (startMinutes < 0) {
        this.notification.addError(
          "start_time must be in HH:mm format",
          `weekly_rules[${index}].start_time`,
        );
      }
      if (endMinutes < 0) {
        this.notification.addError(
          "end_time must be in HH:mm format",
          `weekly_rules[${index}].end_time`,
        );
      }
      if (startMinutes >= 0 && endMinutes >= 0 && endMinutes <= startMinutes) {
        this.notification.addError(
          "end_time must be greater than start_time",
          `weekly_rules[${index}].end_time`,
        );
      }
    }

    const byDayAndFlag = new Map<string, AvailabilityRule[]>();
    for (const r of this.weekly_rules) {
      const key = `${r.weekday}:${r.is_available ? "a" : "u"}`;
      const list = byDayAndFlag.get(key) ?? [];
      list.push(r);
      byDayAndFlag.set(key, list);
    }

    for (const list of byDayAndFlag.values()) {
      const sortedRules = [...list].sort(
        (a, b) =>
          Availability.parseTimeToMinutes(a.start_time) -
          Availability.parseTimeToMinutes(b.start_time),
      );
      for (let i = 1; i < sortedRules.length; i++) {
        const prev = sortedRules[i - 1];
        const curr = sortedRules[i];
        const prevStart = Availability.parseTimeToMinutes(prev.start_time);
        const prevEnd = Availability.parseTimeToMinutes(prev.end_time);
        const currStart = Availability.parseTimeToMinutes(curr.start_time);
        const currEnd = Availability.parseTimeToMinutes(curr.end_time);
        if (prevStart < currEnd && currStart < prevEnd) {
          this.notification.addError(
            "Weekly rules cannot overlap",
            "weekly_rules",
          );
          break;
        }
      }
    }

    return !this.notification.hasErrors();
  }

  static fake() {
    return AvailabilityFakeBuilder;
  }

  toJSON() {
    return {
      id: this.id.id,
      musician_id: this.musician_id?.id ?? null,
      band_id: this.band_id?.id ?? null,
      timezone: this.timezone,
      default_buffer_minutes: this.default_buffer_minutes,
      max_shows_per_day: this.max_shows_per_day,
      weekly_rules: this.weekly_rules.map((r) => ({
        id: r.id.id,
        weekday: r.weekday,
        start_time: r.start_time,
        end_time: r.end_time,
        is_available: r.is_available,
        created_at: r.created_at,
      })),
      unavailabilities: this.unavailabilities.map((u) => ({
        id: u.id.id,
        start_at: u.start_at,
        end_at: u.end_at,
        reason: u.reason,
        created_at: u.created_at,
      })),
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
