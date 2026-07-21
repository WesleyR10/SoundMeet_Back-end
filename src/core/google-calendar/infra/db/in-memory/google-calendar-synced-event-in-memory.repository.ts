import { InMemoryRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  GoogleCalendarSyncedEvent,
  GoogleCalendarSyncedEventId,
} from "../../../domain/google-calendar-synced-event.aggregate";
import { IGoogleCalendarSyncedEventRepository } from "../../../domain/google-calendar-synced-event.repository";

export class GoogleCalendarSyncedEventInMemoryRepository
  extends InMemoryRepository<
    GoogleCalendarSyncedEvent,
    GoogleCalendarSyncedEventId
  >
  implements IGoogleCalendarSyncedEventRepository
{
  getEntity(): new (...args: any[]) => GoogleCalendarSyncedEvent {
    return GoogleCalendarSyncedEvent;
  }

  async findByBookingId(
    booking_id: string,
  ): Promise<GoogleCalendarSyncedEvent | null> {
    return this.items.find((item) => item.booking_id.id === booking_id) ?? null;
  }

  async upsert(entity: GoogleCalendarSyncedEvent): Promise<void> {
    const index = this.items.findIndex(
      (item) => item.booking_id.id === entity.booking_id.id,
    );
    if (index === -1) {
      this.items.push(entity);
      return;
    }
    this.items[index] = entity;
  }
}
