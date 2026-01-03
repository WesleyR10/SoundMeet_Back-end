import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  CalendarTarget,
  ICalendarReadModel,
  WeeklyRule,
} from "../../gateways/calendar-read-model.interface";
import { GetMonthSlotsInput } from "./get-month-slots.input";
import { DaySlotsOutput, GetMonthSlotsOutput } from "./get-month-slots.output";

type BusyInterval = { start_at: Date; end_at: Date };

export class GetMonthSlotsUseCase implements IUseCase<
  GetMonthSlotsInput,
  GetMonthSlotsOutput
> {
  constructor(private readonly calendarReadModel: ICalendarReadModel) {}

  async execute(input: GetMonthSlotsInput): Promise<GetMonthSlotsOutput> {
    const slot_minutes = input.slot_minutes ?? 30;
    if (slot_minutes <= 0) {
      throw new EntityValidationError([
        { slot_minutes: ["invalid slot_minutes"] },
      ]);
    }

    const start_at = new Date(
      Date.UTC(input.year, input.month - 1, 1, 0, 0, 0, 0),
    );
    const end_at = new Date(Date.UTC(input.year, input.month, 1, 0, 0, 0, 0));

    const target: CalendarTarget = {
      type: input.target_type,
      id: input.target_id,
    } as CalendarTarget;

    const [settings, bookings] = await Promise.all([
      this.calendarReadModel.getSettings(target),
      this.calendarReadModel.getBookingsInRange(target, { start_at, end_at }),
    ]);

    const busy: BusyInterval[] = [
      ...settings.unavailabilities.map((u) => ({
        start_at: u.start_at,
        end_at: u.end_at,
      })),
      ...bookings.map((b) => ({
        start_at: new Date(b.start_at.getTime() - b.buffer_minutes * 60 * 1000),
        end_at: new Date(b.end_at.getTime() + b.buffer_minutes * 60 * 1000),
      })),
    ].sort((a, b) => a.start_at.getTime() - b.start_at.getTime());

    const days: DaySlotsOutput[] = [];
    for (
      let cursor = new Date(start_at);
      cursor.getTime() < end_at.getTime();
    ) {
      const dayStart = new Date(cursor);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const weekday = dayStart.getUTCDay();
      const date = dayStart.toISOString().slice(0, 10);

      const slots = this.buildDaySlots({
        dayStart,
        dayEnd,
        weekday,
        weekly_rules: settings.weekly_rules,
        busy,
        slot_minutes,
        is_active: settings.is_active,
      });

      days.push({ date, slots });
      cursor = dayEnd;
    }

    return {
      target_type: input.target_type,
      target_id: input.target_id,
      year: input.year,
      month: input.month,
      slot_minutes,
      days,
    };
  }

  private buildDaySlots(props: {
    dayStart: Date;
    dayEnd: Date;
    weekday: number;
    weekly_rules: WeeklyRule[];
    busy: BusyInterval[];
    slot_minutes: number;
    is_active: boolean;
  }) {
    if (!props.is_active) {
      return [];
    }

    const rulesForDay = props.weekly_rules.filter(
      (r) => r.weekday === props.weekday,
    );
    const availableRules = rulesForDay.filter((r) => r.is_available);
    if (!availableRules.length) {
      return [];
    }

    const slots: Array<{ start_at: Date; end_at: Date }> = [];
    for (const rule of availableRules) {
      const ruleStart = GetMonthSlotsUseCase.parseTimeToMinutes(
        rule.start_time,
      );
      const ruleEnd = GetMonthSlotsUseCase.parseTimeToMinutes(rule.end_time);
      if (ruleStart < 0 || ruleEnd < 0 || ruleEnd <= ruleStart) {
        continue;
      }

      for (
        let minute = ruleStart;
        minute + props.slot_minutes <= ruleEnd;
        minute += props.slot_minutes
      ) {
        const start_at = new Date(
          props.dayStart.getTime() + minute * 60 * 1000,
        );
        const end_at = new Date(
          start_at.getTime() + props.slot_minutes * 60 * 1000,
        );
        if (end_at.getTime() > props.dayEnd.getTime()) {
          break;
        }

        if (
          !GetMonthSlotsUseCase.isAllowedByWeeklyRules(
            rulesForDay,
            start_at,
            end_at,
          )
        ) {
          continue;
        }

        if (GetMonthSlotsUseCase.overlapsBusy(props.busy, start_at, end_at)) {
          continue;
        }

        slots.push({ start_at, end_at });
      }
    }

    return slots;
  }

  private static overlapsBusy(
    busy: BusyInterval[],
    start_at: Date,
    end_at: Date,
  ): boolean {
    const start = start_at.getTime();
    const end = end_at.getTime();
    return busy.some(
      (b) => start < b.end_at.getTime() && b.start_at.getTime() < end,
    );
  }

  private static isAllowedByWeeklyRules(
    rulesForDay: WeeklyRule[],
    start_at: Date,
    end_at: Date,
  ): boolean {
    const slotStartMinutes =
      start_at.getUTCHours() * 60 + start_at.getUTCMinutes();
    const slotEndMinutes = end_at.getUTCHours() * 60 + end_at.getUTCMinutes();

    const availableRules = rulesForDay.filter((r) => r.is_available);
    const unavailableRules = rulesForDay.filter((r) => !r.is_available);

    const insideAvailable = availableRules.some((r) => {
      const rStart = GetMonthSlotsUseCase.parseTimeToMinutes(r.start_time);
      const rEnd = GetMonthSlotsUseCase.parseTimeToMinutes(r.end_time);
      return rStart <= slotStartMinutes && slotEndMinutes <= rEnd;
    });

    if (!insideAvailable) {
      return false;
    }

    const hitsUnavailable = unavailableRules.some((r) => {
      const rStart = GetMonthSlotsUseCase.parseTimeToMinutes(r.start_time);
      const rEnd = GetMonthSlotsUseCase.parseTimeToMinutes(r.end_time);
      return slotStartMinutes < rEnd && rStart < slotEndMinutes;
    });

    return !hitsUnavailable;
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
}
