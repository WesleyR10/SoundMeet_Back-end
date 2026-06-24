import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { BookingStatusEnum } from "../../../../shared/domain/value-objects/booking-status.vo";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Booking, BookingId } from "../../../domain/booking.aggregate";
import {
  BookingFilter,
  BookingSearchParams,
  BookingSearchResult,
  IBookingRepository,
} from "../../../domain/booking.repository";

export class BookingInMemoryRepository
  extends InMemorySearchableRepository<Booking, BookingId, BookingFilter>
  implements IBookingRepository
{
  sortableFields: string[] = [
    "created_at",
    "updated_at",
    "start_at",
    "end_at",
    "status",
  ];

  async search(props: BookingSearchParams): Promise<BookingSearchResult> {
    const result = await super.search(props);
    return new BookingSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  async findPendingExpired(now: Date): Promise<Booking[]> {
    const nowMs = now.getTime();
    return this.items.filter((booking) => {
      if (!booking.status.isPending()) return false;
      if (!booking.expires_at) return false;
      return booking.expires_at.getTime() <= nowMs;
    });
  }

  async expirePendingExpired(now: Date): Promise<number> {
    let expired = 0;
    for (const booking of this.items) {
      if (!booking.status.isPending()) continue;
      if (!booking.expires_at) continue;
      if (booking.expires_at.getTime() > now.getTime()) continue;
      booking.expire(now);
      if (!booking.status.isExpired()) continue;
      expired += 1;
    }
    return expired;
  }

  async updateWithStatus(
    entity: Booking,
    expected_statuses: BookingStatusEnum[],
  ): Promise<boolean> {
    const index = this.items.findIndex((item) =>
      item.booking_id.equals(entity.booking_id),
    );
    if (index < 0) {
      return false;
    }

    const current = this.items[index];
    if (
      !expected_statuses.includes(current.status.value as BookingStatusEnum)
    ) {
      return false;
    }

    this.items[index] = entity;
    return true;
  }

  async findConfirmedInRangeByMusician(
    musician_id: string,
    start: Date,
    end: Date,
  ): Promise<Booking[]> {
    return this.items.filter((booking) => {
      if (!booking.status.isConfirmed()) return false;
      if (booking.musician_id?.id !== musician_id) return false;

      const bookingStart = booking.bufferedStartAt.getTime();
      const bookingEnd = booking.bufferedEndAt.getTime();
      const rangeStart = start.getTime();
      const rangeEnd = end.getTime();
      return bookingStart < rangeEnd && rangeStart < bookingEnd;
    });
  }

  async findConfirmedInRangeByBand(
    band_id: string,
    start: Date,
    end: Date,
  ): Promise<Booking[]> {
    return this.items.filter((booking) => {
      if (!booking.status.isConfirmed()) return false;
      if (booking.band_id?.id !== band_id) return false;

      const bookingStart = booking.bufferedStartAt.getTime();
      const bookingEnd = booking.bufferedEndAt.getTime();
      const rangeStart = start.getTime();
      const rangeEnd = end.getTime();
      return bookingStart < rangeEnd && rangeStart < bookingEnd;
    });
  }

  async countConfirmedOnDayByMusician(
    musician_id: string,
    day: Date,
    _timezone?: string,
  ): Promise<number> {
    const [start, end] = this.getUtcDayRange(day);
    return this.items.filter(
      (booking) =>
        booking.status.isConfirmed() &&
        booking.musician_id?.id === musician_id &&
        booking.start_at >= start &&
        booking.start_at < end,
    ).length;
  }

  async countConfirmedOnDayByBand(
    band_id: string,
    day: Date,
    _timezone?: string,
  ): Promise<number> {
    const [start, end] = this.getUtcDayRange(day);
    return this.items.filter(
      (booking) =>
        booking.status.isConfirmed() &&
        booking.band_id?.id === band_id &&
        booking.start_at >= start &&
        booking.start_at < end,
    ).length;
  }

  protected async applyFilter(
    items: Booking[],
    filter: BookingFilter | null,
  ): Promise<Booking[]> {
    if (!filter) {
      return items;
    }

    return items.filter((booking) => {
      let matches = true;

      if (filter.establishment_id) {
        matches =
          matches && booking.establishment_id.id === filter.establishment_id;
      }

      if (filter.musician_id) {
        matches = matches && booking.musician_id?.id === filter.musician_id;
      }

      if (filter.band_id) {
        matches = matches && booking.band_id?.id === filter.band_id;
      }

      if (filter.event_id) {
        matches = matches && booking.event_id?.id === filter.event_id;
      }

      if (filter.status) {
        matches = matches && booking.status.value === filter.status;
      }

      if (filter.start_at_gte) {
        matches = matches && booking.start_at >= filter.start_at_gte;
      }

      if (filter.start_at_lte) {
        matches = matches && booking.start_at <= filter.start_at_lte;
      }

      if (filter.end_at_gte) {
        matches = matches && booking.end_at >= filter.end_at_gte;
      }

      if (filter.end_at_lte) {
        matches = matches && booking.end_at <= filter.end_at_lte;
      }

      return matches;
    });
  }

  getEntity(): new (...args: any[]) => Booking {
    return Booking;
  }

  protected applySort(
    items: Booking[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ) {
    return sort
      ? super.applySort(items, sort, sort_dir, (sort, item) => {
          if (sort === "status") {
            return item.status.value;
          }
          if (sort === "start_at") {
            return item.start_at.getTime();
          }
          if (sort === "end_at") {
            return item.end_at.getTime();
          }
          if (sort === "created_at") {
            return item.created_at.getTime();
          }
          if (sort === "updated_at") {
            return item.updated_at.getTime();
          }
          return item[sort];
        })
      : super.applySort(items, "created_at", "desc");
  }

  private getUtcDayRange(day: Date): [Date, Date] {
    const start = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
    );
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return [start, end];
  }
}
