import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  BookingEscrow,
  BookingEscrowId,
} from "../../../domain/booking-escrow.aggregate";
import { BookingEscrowStatus } from "../../../domain/booking-escrow-enums";
import {
  BookingEscrowFilter,
  BookingEscrowSearchParams,
  BookingEscrowSearchResult,
  IBookingEscrowRepository,
} from "../../../domain/repositories/booking-escrow.repository";

export class BookingEscrowInMemoryRepository
  extends InMemorySearchableRepository<
    BookingEscrow,
    BookingEscrowId,
    BookingEscrowFilter
  >
  implements IBookingEscrowRepository
{
  sortableFields: string[] = ["created_at", "amount", "released_at"];

  async search(
    props: BookingEscrowSearchParams,
  ): Promise<BookingEscrowSearchResult> {
    const result = await super.search(props);
    return new BookingEscrowSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  getEntity(): new (...args: any[]) => BookingEscrow {
    return BookingEscrow;
  }

  async findByBookingId(bookingId: string): Promise<BookingEscrow | null> {
    return this.items.find((i) => i.booking_id.id === bookingId) ?? null;
  }

  async findByExternalId(externalId: string): Promise<BookingEscrow | null> {
    return this.items.find((i) => i.external_id === externalId) ?? null;
  }

  async findReleasable(before: Date, limit: number): Promise<BookingEscrow[]> {
    return this.items
      .filter(
        (i) =>
          i.status === BookingEscrowStatus.HELD &&
          i.held_at !== null &&
          i.held_at <= before,
      )
      .slice(0, limit);
  }

  protected async applyFilter(
    items: BookingEscrow[],
    filter: BookingEscrowFilter | null,
  ): Promise<BookingEscrow[]> {
    if (!filter) {
      return items;
    }

    return items.filter((item) => {
      if (filter.musician_id && item.musician_id?.id !== filter.musician_id) {
        return false;
      }
      if (filter.booking_id && item.booking_id.id !== filter.booking_id) {
        return false;
      }
      if (filter.status && item.status !== filter.status) {
        return false;
      }
      return true;
    });
  }
}
