import {
  BookingStatus as PrismaBookingStatus,
  PrismaClient,
} from "@prisma/client";

import {
  BookingReadModel,
  CalendarSettingsReadModel,
  CalendarTarget,
  ICalendarReadModel,
} from "../../../application/gateways/calendar-read-model.interface";

export class CalendarPrismaReadModel implements ICalendarReadModel {
  constructor(private readonly prisma: PrismaClient) {}

  async getSettings(
    target: CalendarTarget,
  ): Promise<CalendarSettingsReadModel> {
    if (target.type === "musician") {
      const settings = await this.prisma.musicianCalendarSettings.findUnique({
        where: { musicianId: target.id },
      });

      const [weekly_rules, unavailabilities] = await Promise.all([
        this.prisma.musicianAvailabilityRule.findMany({
          where: { musicianId: target.id },
          orderBy: [{ weekday: "asc" }, { start_time: "asc" }],
        }),
        this.prisma.musicianUnavailability.findMany({
          where: { musicianId: target.id },
          orderBy: { start_at: "asc" },
        }),
      ]);

      return {
        timezone: settings?.timezone ?? "UTC",
        default_buffer_minutes: settings?.default_buffer_minutes ?? 0,
        max_shows_per_day: settings?.max_shows_per_day ?? null,
        is_active: settings?.is_active ?? true,
        weekly_rules: weekly_rules.map((r) => ({
          weekday: r.weekday,
          start_time: r.start_time,
          end_time: r.end_time,
          is_available: r.is_available,
        })),
        unavailabilities: unavailabilities.map((u) => ({
          start_at: u.start_at,
          end_at: u.end_at,
          reason: u.reason ?? null,
        })),
      };
    }

    const settings = await this.prisma.bandCalendarSettings.findUnique({
      where: { bandId: target.id },
    });

    const unavailabilities = await this.prisma.bandUnavailability.findMany({
      where: { bandId: target.id },
      orderBy: { start_at: "asc" },
    });

    return {
      timezone: settings?.timezone ?? "UTC",
      default_buffer_minutes: settings?.default_buffer_minutes ?? 0,
      max_shows_per_day: settings?.max_shows_per_day ?? null,
      is_active: settings?.is_active ?? true,
      weekly_rules: [],
      unavailabilities: unavailabilities.map((u) => ({
        start_at: u.start_at,
        end_at: u.end_at,
        reason: u.reason ?? null,
      })),
    };
  }

  async getBookingsInRange(
    target: CalendarTarget,
    range: { start_at: Date; end_at: Date },
    statuses: string[] = ["confirmed", "completed"],
  ): Promise<BookingReadModel[]> {
    const where =
      target.type === "musician"
        ? {
            musicianId: target.id,
            status: { in: statuses as PrismaBookingStatus[] },
            start_at: { lt: range.end_at },
            end_at: { gt: range.start_at },
          }
        : {
            bandId: target.id,
            status: { in: statuses as PrismaBookingStatus[] },
            start_at: { lt: range.end_at },
            end_at: { gt: range.start_at },
          };

    const bookings = await this.prisma.booking.findMany({
      where,
      orderBy: { start_at: "asc" },
      select: {
        id: true,
        start_at: true,
        end_at: true,
        buffer_minutes: true,
        status: true,
      },
    });

    return bookings.map((b) => ({
      id: b.id,
      start_at: b.start_at,
      end_at: b.end_at,
      buffer_minutes: b.buffer_minutes,
      status: b.status,
    }));
  }
}
