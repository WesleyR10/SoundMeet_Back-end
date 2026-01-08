import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  IDateTimeService,
  parseTimeToMinutes,
} from "../../../../shared/domain";
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
  constructor(
    private readonly calendarReadModel: ICalendarReadModel,
    private readonly dateTimeService: IDateTimeService,
  ) {}

  async execute(input: GetMonthSlotsInput): Promise<GetMonthSlotsOutput> {
    const slot_minutes = input.slot_minutes ?? 30;
    if (slot_minutes <= 0) {
      throw new EntityValidationError([
        { slot_minutes: ["invalid slot_minutes"] },
      ]);
    }

    const target: CalendarTarget = {
      type: input.target_type,
      id: input.target_id,
    } as CalendarTarget;

    const settings = await this.calendarReadModel.getSettings(target);
    const timezone = settings.timezone ?? "UTC";
    const range = this.dateTimeService.getUtcRangeForMonth({
      year: input.year,
      month: input.month,
      timezone,
    });

    const bookings = await this.calendarReadModel.getBookingsInRange(target, {
      start_at: range.start_at,
      end_at: range.end_at,
    });

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
      let dayStart = new Date(range.start_at);
      dayStart.getTime() < range.end_at.getTime();
      dayStart = this.dateTimeService.addDaysKeepingLocalTime(
        dayStart,
        1,
        timezone,
      )
    ) {
      const dayEnd = this.dateTimeService.addDaysKeepingLocalTime(
        dayStart,
        1,
        timezone,
      );
      const weekday = this.dateTimeService.getLocalWeekday(dayStart, timezone);
      const date = this.dateTimeService.toLocalDateString(dayStart, timezone);

      const slots = this.buildDaySlots({
        localDate: date,
        dayStart,
        dayEnd,
        weekday,
        timezone,
        weekly_rules: settings.weekly_rules,
        busy,
        slot_minutes,
        is_active: settings.is_active,
      });

      days.push({ date, slots });
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
    localDate: string;
    dayStart: Date;
    dayEnd: Date;
    weekday: number;
    timezone: string;
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
    const dateParts = GetMonthSlotsUseCase.parseIsoDate(props.localDate);
    if (!dateParts) {
      return [];
    }

    for (const rule of availableRules) {
      const ruleStart = parseTimeToMinutes(rule.start_time);
      const ruleEnd = parseTimeToMinutes(rule.end_time);
      if (ruleStart < 0 || ruleEnd < 0 || ruleEnd <= ruleStart) {
        continue;
      }

      for (
        let minute = ruleStart;
        minute + props.slot_minutes <= ruleEnd;
        minute += props.slot_minutes
      ) {
        const startTime = GetMonthSlotsUseCase.minutesToTime(minute);
        const endTime = GetMonthSlotsUseCase.minutesToTime(
          minute + props.slot_minutes,
        );

        const start_at = this.dateTimeService.fromLocalDateTime({
          date: dateParts,
          time: startTime,
          timezone: props.timezone,
        });
        const end_at = this.dateTimeService.fromLocalDateTime({
          date: dateParts,
          time: endTime,
          timezone: props.timezone,
        });

        if (!start_at || !end_at) {
          continue;
        }

        if (end_at.getTime() > props.dayEnd.getTime()) {
          break;
        }

        if (
          !GetMonthSlotsUseCase.isAllowedByWeeklyRulesMinutes(
            rulesForDay,
            minute,
            minute + props.slot_minutes,
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

  private static isAllowedByWeeklyRulesMinutes(
    rulesForDay: WeeklyRule[],
    slotStartMinutes: number,
    slotEndMinutes: number,
  ): boolean {
    const availableRules = rulesForDay.filter((r) => r.is_available);
    const unavailableRules = rulesForDay.filter((r) => !r.is_available);

    const insideAvailable = availableRules.some((r) => {
      const rStart = parseTimeToMinutes(r.start_time);
      const rEnd = parseTimeToMinutes(r.end_time);
      return rStart <= slotStartMinutes && slotEndMinutes <= rEnd;
    });

    if (!insideAvailable) {
      return false;
    }

    const hitsUnavailable = unavailableRules.some((r) => {
      const rStart = parseTimeToMinutes(r.start_time);
      const rEnd = parseTimeToMinutes(r.end_time);
      return slotStartMinutes < rEnd && rStart < slotEndMinutes;
    });

    return !hitsUnavailable;
  }

  private static minutesToTime(totalMinutes: number) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return { hour, minute };
  }

  private static parseIsoDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (
      Number.isNaN(year) ||
      Number.isNaN(month) ||
      Number.isNaN(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }
    return { year, month, day };
  }
}
