import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import {
  GoogleCalendarSyncedEvent,
  GoogleCalendarSyncedEventId,
  GoogleCalendarSyncStatus,
} from "./google-calendar-synced-event.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class GoogleCalendarSyncedEventFakeBuilder<TBuild = any> {
  private _synced_event_id:
    | PropOrFactory<GoogleCalendarSyncedEventId>
    | undefined = undefined;
  private _booking_id: PropOrFactory<Uuid> | undefined = undefined;
  private _musician_id: PropOrFactory<Uuid> | undefined = undefined;
  private _google_event_id: PropOrFactory<string | null> | undefined =
    undefined;
  private _status: PropOrFactory<GoogleCalendarSyncStatus> | undefined =
    undefined;
  private _last_error: PropOrFactory<string | null> | undefined = undefined;
  private _synced_at: PropOrFactory<Date | null> | undefined = undefined;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;

  static aGoogleCalendarSyncedEvent() {
    return new GoogleCalendarSyncedEventFakeBuilder<GoogleCalendarSyncedEvent>();
  }

  static theGoogleCalendarSyncedEvents(countObjs: number) {
    return new GoogleCalendarSyncedEventFakeBuilder<
      GoogleCalendarSyncedEvent[]
    >(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
  }

  withSyncedEventId(
    valueOrFactory: PropOrFactory<GoogleCalendarSyncedEventId>,
  ) {
    this._synced_event_id = valueOrFactory;
    return this;
  }

  withBookingId(valueOrFactory: PropOrFactory<Uuid>) {
    this._booking_id = valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<Uuid>) {
    this._musician_id = valueOrFactory;
    return this;
  }

  withGoogleEventId(valueOrFactory: PropOrFactory<string | null>) {
    this._google_event_id = valueOrFactory;
    return this;
  }

  withStatus(valueOrFactory: PropOrFactory<GoogleCalendarSyncStatus>) {
    this._status = valueOrFactory;
    return this;
  }

  synced() {
    this._status = "synced";
    this._google_event_id = (index: number) => `google-event-${index}`;
    this._synced_at = new Date();
    return this;
  }

  withLastError(valueOrFactory: PropOrFactory<string | null>) {
    this._last_error = valueOrFactory;
    return this;
  }

  withSyncedAt(valueOrFactory: PropOrFactory<Date | null>) {
    this._synced_at = valueOrFactory;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  withUpdatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._updated_at = valueOrFactory;
    return this;
  }

  build(): TBuild {
    const syncedEvents = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        return new GoogleCalendarSyncedEvent({
          synced_event_id:
            this.callFactory(this._synced_event_id, index) ??
            new GoogleCalendarSyncedEventId(),
          booking_id: this.callFactory(this._booking_id, index) ?? new Uuid(),
          musician_id: this.callFactory(this._musician_id, index) ?? new Uuid(),
          google_event_id:
            this.callFactory(this._google_event_id, index) ?? null,
          status: this.callFactory(this._status, index) ?? "pending",
          last_error: this.callFactory(this._last_error, index) ?? null,
          synced_at: this.callFactory(this._synced_at, index) ?? null,
          created_at: this.callFactory(this._created_at, index) ?? new Date(),
          updated_at: this.callFactory(this._updated_at, index) ?? new Date(),
        });
      });
    return this.countObjs === 1
      ? (syncedEvents[0] as any)
      : (syncedEvents as any);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
