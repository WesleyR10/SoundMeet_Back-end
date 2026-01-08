import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  CalendarTarget,
  ICalendarReadModel,
} from "../../gateways/calendar-read-model.interface";
import { GetFreeBusyInput } from "./get-free-busy.input";
import { BusyIntervalOutput, GetFreeBusyOutput } from "./get-free-busy.output";

export class GetFreeBusyUseCase implements IUseCase<
  GetFreeBusyInput,
  GetFreeBusyOutput
> {
  constructor(private readonly calendarReadModel: ICalendarReadModel) {}

  async execute(input: GetFreeBusyInput): Promise<GetFreeBusyOutput> {
    const errors: any[] = [];
    if (input.end_at.getTime() <= input.start_at.getTime()) {
      errors.push({ end_at: ["end_at must be greater than start_at"] });
    }

    const maxRangeMs = 366 * 24 * 60 * 60 * 1000; // 1 Ano
    if (input.end_at.getTime() - input.start_at.getTime() > maxRangeMs) {
      errors.push({ range: ["range is too large"] });
    }

    if (errors.length) {
      throw new EntityValidationError(errors);
    }

    const target: CalendarTarget = {
      type: input.target_type,
      id: input.target_id,
    } as CalendarTarget;

    const [settings, bookings] = await Promise.all([
      this.calendarReadModel.getSettings(target),
      this.calendarReadModel.getBookingsInRange(target, {
        start_at: input.start_at,
        end_at: input.end_at,
      }),
    ]);

    if (!settings.is_active) {
      return {
        target_type: input.target_type,
        target_id: input.target_id,
        start_at: input.start_at,
        end_at: input.end_at,
        busy: [
          {
            start_at: input.start_at,
            end_at: input.end_at,
            kind: "unavailability",
            reason: "inactive_calendar",
          },
        ],
      };
    }

    const intervals: BusyIntervalOutput[] = [];

    for (const b of bookings) {
      const start_at = new Date(
        b.start_at.getTime() - b.buffer_minutes * 60 * 1000,
      );
      const end_at = new Date(
        b.end_at.getTime() + b.buffer_minutes * 60 * 1000,
      );
      intervals.push({
        start_at,
        end_at,
        kind: "booking",
        booking_id: b.id,
        status: b.status,
      });
    }

    for (const u of settings.unavailabilities) {
      intervals.push({
        start_at: u.start_at,
        end_at: u.end_at,
        kind: "unavailability",
        reason: u.reason,
      });
    }

    const merged = GetFreeBusyUseCase.mergeIntervals(intervals);

    return {
      target_type: input.target_type,
      target_id: input.target_id,
      start_at: input.start_at,
      end_at: input.end_at,
      busy: merged,
    };
  }

  private static mergeIntervals(
    intervals: BusyIntervalOutput[],
  ): BusyIntervalOutput[] {
    const sorted = [...intervals].sort(
      (a, b) => a.start_at.getTime() - b.start_at.getTime(),
    );

    const result: BusyIntervalOutput[] = [];
    for (const current of sorted) {
      const last = result[result.length - 1];
      if (!last) {
        result.push({ ...current });
        continue;
      }

      if (current.start_at.getTime() <= last.end_at.getTime()) {
        if (current.end_at.getTime() > last.end_at.getTime()) {
          last.end_at = current.end_at;
        }

        const mergedKind =
          last.kind === "unavailability" || current.kind === "unavailability"
            ? "unavailability"
            : "booking";

        if (mergedKind === "booking") {
          last.kind = "booking";
          if (last.booking_id && current.booking_id) {
            if (last.booking_id !== current.booking_id) {
              last.booking_id = undefined;
              last.status = undefined;
              last.reason = "merged_booking";
            }
          } else {
            last.booking_id = undefined;
            last.status = undefined;
            last.reason = "merged_booking";
          }
        } else {
          last.kind = "unavailability";
          last.booking_id = undefined;
          last.status = undefined;

          if (last.reason && current.reason && last.reason !== current.reason) {
            last.reason = "merged_unavailability";
          } else {
            last.reason =
              last.reason ?? current.reason ?? "merged_unavailability";
          }
        }
        continue;
      }

      result.push({ ...current });
    }

    return result;
  }
}
