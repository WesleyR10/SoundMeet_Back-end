import { IRepository } from "../../shared/domain/repository/repository-interface";
import {
  GoogleCalendarSyncedEvent,
  GoogleCalendarSyncedEventId,
} from "./google-calendar-synced-event.aggregate";

export interface IGoogleCalendarSyncedEventRepository extends IRepository<
  GoogleCalendarSyncedEvent,
  GoogleCalendarSyncedEventId
> {
  findByBookingId(
    booking_id: string,
  ): Promise<GoogleCalendarSyncedEvent | null>;
  /** Insere ou substitui pelo booking_id (unique) — retries precisam de upsert. */
  upsert(entity: GoogleCalendarSyncedEvent): Promise<void>;
}
