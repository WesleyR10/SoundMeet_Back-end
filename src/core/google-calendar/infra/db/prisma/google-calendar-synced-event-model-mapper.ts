import { GoogleCalendarSyncedEvent as PrismaGoogleCalendarSyncedEvent } from "@prisma/client";

import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import {
  GoogleCalendarSyncedEvent,
  GoogleCalendarSyncedEventId,
  GoogleCalendarSyncStatus,
} from "../../../domain/google-calendar-synced-event.aggregate";

export type GoogleCalendarSyncedEventModelProps = {
  id: string;
  bookingId: string;
  musicianId: string;
  googleEventId: string | null;
  status: string;
  lastError: string | null;
  syncedAt: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class GoogleCalendarSyncedEventModelMapper {
  static toModel(
    entity: GoogleCalendarSyncedEvent,
  ): GoogleCalendarSyncedEventModelProps {
    return {
      id: entity.synced_event_id.id,
      bookingId: entity.booking_id.id,
      musicianId: entity.musician_id.id,
      googleEventId: entity.google_event_id,
      status: entity.status,
      lastError: entity.last_error,
      syncedAt: entity.synced_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(
    model: PrismaGoogleCalendarSyncedEvent,
  ): GoogleCalendarSyncedEvent {
    const syncedEvent = new GoogleCalendarSyncedEvent({
      synced_event_id: new GoogleCalendarSyncedEventId(model.id),
      booking_id: new Uuid(model.bookingId),
      musician_id: new Uuid(model.musicianId),
      google_event_id: model.googleEventId,
      status: model.status as GoogleCalendarSyncStatus,
      last_error: model.lastError,
      synced_at: model.syncedAt,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    syncedEvent.validate();
    if (syncedEvent.notification.hasErrors()) {
      throw new LoadEntityError(syncedEvent.notification.toJSON());
    }

    return syncedEvent;
  }
}
