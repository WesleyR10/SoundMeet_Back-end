import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { GoogleCalendarSyncedEventValidatorFactory } from "./google-calendar-synced-event.validator";
import { GoogleCalendarSyncedEventFakeBuilder } from "./google-calendar-synced-event-fake.builder";

export class GoogleCalendarSyncedEventId extends Uuid {}

/**
 * Status operacional de sincronização (telemetria evolutiva) — String no
 * Prisma, nunca enum, seguindo a convenção dos workers (ai-audio/ai-cifra).
 */
export type GoogleCalendarSyncStatus =
  | "pending"
  | "synced"
  | "failed"
  | "deleted";

const MAX_LAST_ERROR_LENGTH = 500;

export type GoogleCalendarSyncedEventConstructorProps = {
  synced_event_id?: GoogleCalendarSyncedEventId;
  booking_id: Uuid;
  musician_id: Uuid;
  google_event_id?: string | null;
  status?: GoogleCalendarSyncStatus;
  last_error?: string | null;
  synced_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
};

/**
 * Registro de mapeamento Booking → evento no Google Calendar. Existe para dar
 * idempotência aos retries (distinguir "nunca tentado" / "sincronizado" /
 * "falhou") sem acoplar essa contabilidade ao schema do domínio scheduling.
 */
export class GoogleCalendarSyncedEvent extends AggregateRoot {
  synced_event_id: GoogleCalendarSyncedEventId;
  booking_id: Uuid;
  musician_id: Uuid;
  google_event_id: string | null;
  status: GoogleCalendarSyncStatus;
  last_error: string | null;
  synced_at: Date | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: GoogleCalendarSyncedEventConstructorProps) {
    super();
    this.synced_event_id =
      props.synced_event_id ?? new GoogleCalendarSyncedEventId();
    this.booking_id = props.booking_id;
    this.musician_id = props.musician_id;
    this.google_event_id = props.google_event_id ?? null;
    this.status = props.status ?? "pending";
    this.last_error = props.last_error ?? null;
    this.synced_at = props.synced_at ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): GoogleCalendarSyncedEventId {
    return this.synced_event_id;
  }

  static create(command: {
    booking_id: string;
    musician_id: string;
  }): GoogleCalendarSyncedEvent {
    const syncedEvent = new GoogleCalendarSyncedEvent({
      booking_id: new Uuid(command.booking_id),
      musician_id: new Uuid(command.musician_id),
    });
    syncedEvent.validate();
    return syncedEvent;
  }

  markSynced(google_event_id: string): void {
    this.google_event_id = google_event_id;
    this.status = "synced";
    this.last_error = null;
    this.synced_at = new Date();
    this.updated_at = new Date();
  }

  markFailed(error_message: string): void {
    this.status = "failed";
    this.last_error = error_message.slice(0, MAX_LAST_ERROR_LENGTH);
    this.updated_at = new Date();
  }

  markDeleted(): void {
    this.status = "deleted";
    this.last_error = null;
    this.updated_at = new Date();
  }

  get isSynced(): boolean {
    return this.status === "synced" && this.google_event_id !== null;
  }

  validate(fields?: string[]): boolean {
    const validator = GoogleCalendarSyncedEventValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return GoogleCalendarSyncedEventFakeBuilder;
  }

  toJSON() {
    return {
      synced_event_id: this.synced_event_id.id,
      booking_id: this.booking_id.id,
      musician_id: this.musician_id.id,
      google_event_id: this.google_event_id,
      status: this.status,
      last_error: this.last_error,
      synced_at: this.synced_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
