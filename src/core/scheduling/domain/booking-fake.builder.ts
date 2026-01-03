import { Chance } from "chance";
import { v4 as uuidv4 } from "uuid";

import { BookingStatus } from "../../shared/domain/value-objects/booking-status.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { Booking, BookingId } from "./booking.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class BookingFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<BookingId> | undefined = undefined;
  private _establishment_id: PropOrFactory<string> = (_index) => uuidv4();
  private _musician_id: PropOrFactory<string | null> = (_index) => uuidv4();
  private _band_id: PropOrFactory<string | null> = (_index) => null;
  private _event_id: PropOrFactory<string | null> = (_index) => null;
  private _start_at: PropOrFactory<Date> = (_index) => new Date();
  private _end_at: PropOrFactory<Date> = (_index) =>
    new Date(Date.now() + 1000 * 60 * 60);
  private _fee: PropOrFactory<number | null> = (_index) => null;
  private _notes: PropOrFactory<string | null> = (_index) =>
    this.chance.sentence({ words: 5 });
  private _status: PropOrFactory<BookingStatus> = (_index) =>
    BookingStatus.pending();
  private _buffer_minutes: PropOrFactory<number> = (_index) => 0;
  private _expires_at: PropOrFactory<Date | null> = (_index) =>
    new Date(Date.now() + 1000 * 60 * 60 * 48);
  private _free_cancellation_hours: PropOrFactory<number> = (_index) => 72;
  private _confirmed_at: PropOrFactory<Date | null> = (_index) => null;
  private _cancelled_at: PropOrFactory<Date | null> = (_index) => null;
  private _completed_at: PropOrFactory<Date | null> = (_index) => null;
  private _created_at: PropOrFactory<Date> = (_index) => new Date();
  private _updated_at: PropOrFactory<Date> = (_index) => new Date();

  private countObjs;
  private chance: Chance.Chance;

  static aBooking() {
    return new BookingFakeBuilder<Booking>();
  }

  static theBookings(countObjs: number) {
    return new BookingFakeBuilder<Booking[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withId(valueOrFactory: PropOrFactory<BookingId>) {
    this._id = valueOrFactory;
    return this;
  }

  withEstablishmentId(valueOrFactory: PropOrFactory<string | Uuid>) {
    this._establishment_id =
      typeof valueOrFactory === "function"
        ? (index: number) => {
            const result = valueOrFactory(index);
            return result instanceof Uuid ? result.id : result;
          }
        : valueOrFactory instanceof Uuid
          ? valueOrFactory.id
          : valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<string | Uuid | null>) {
    this._musician_id =
      typeof valueOrFactory === "function"
        ? (index: number) => {
            const result = valueOrFactory(index);
            if (result === null) return null;
            return result instanceof Uuid ? result.id : result;
          }
        : valueOrFactory instanceof Uuid
          ? valueOrFactory.id
          : valueOrFactory;
    return this;
  }

  withBandId(valueOrFactory: PropOrFactory<string | Uuid | null>) {
    this._band_id =
      typeof valueOrFactory === "function"
        ? (index: number) => {
            const result = valueOrFactory(index);
            if (result === null) return null;
            return result instanceof Uuid ? result.id : result;
          }
        : valueOrFactory instanceof Uuid
          ? valueOrFactory.id
          : valueOrFactory;
    return this;
  }

  withEventId(valueOrFactory: PropOrFactory<string | Uuid | null>) {
    this._event_id =
      typeof valueOrFactory === "function"
        ? (index: number) => {
            const result = valueOrFactory(index);
            if (result === null) return null;
            return result instanceof Uuid ? result.id : result;
          }
        : valueOrFactory instanceof Uuid
          ? valueOrFactory.id
          : valueOrFactory;
    return this;
  }

  withStartAt(valueOrFactory: PropOrFactory<Date>) {
    this._start_at = valueOrFactory;
    return this;
  }

  withEndAt(valueOrFactory: PropOrFactory<Date>) {
    this._end_at = valueOrFactory;
    return this;
  }

  withBufferMinutes(valueOrFactory: PropOrFactory<number>) {
    this._buffer_minutes = valueOrFactory;
    return this;
  }

  withExpiresAt(valueOrFactory: PropOrFactory<Date | null>) {
    this._expires_at = valueOrFactory;
    return this;
  }

  pending() {
    this._status = () => BookingStatus.pending();
    this._confirmed_at = () => null;
    this._cancelled_at = () => null;
    this._completed_at = () => null;
    return this;
  }

  confirmed() {
    this._status = () => BookingStatus.confirmed();
    this._confirmed_at = () => new Date();
    return this;
  }

  cancelled() {
    this._status = () => BookingStatus.cancelled();
    this._cancelled_at = () => new Date();
    return this;
  }

  completed() {
    this._status = () => BookingStatus.completed();
    this._completed_at = () => new Date();
    return this;
  }

  expired() {
    this._status = () => BookingStatus.expired();
    return this;
  }

  build(): TBuild {
    const bookings = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const booking = new Booking({
          id: !this._id ? undefined : this.callFactory(this._id, index),
          establishment_id: this.callFactory(this._establishment_id, index),
          musician_id: this.callFactory(this._musician_id, index),
          band_id: this.callFactory(this._band_id, index),
          event_id: this.callFactory(this._event_id, index),
          start_at: this.callFactory(this._start_at, index),
          end_at: this.callFactory(this._end_at, index),
          fee: this.callFactory(this._fee, index),
          notes: this.callFactory(this._notes, index),
          status: this.callFactory(this._status, index),
          buffer_minutes: this.callFactory(this._buffer_minutes, index),
          expires_at: this.callFactory(this._expires_at, index),
          free_cancellation_hours: this.callFactory(
            this._free_cancellation_hours,
            index,
          ),
          confirmed_at: this.callFactory(this._confirmed_at, index),
          cancelled_at: this.callFactory(this._cancelled_at, index),
          completed_at: this.callFactory(this._completed_at, index),
          created_at: this.callFactory(this._created_at, index),
          updated_at: this.callFactory(this._updated_at, index),
        });
        booking.validate();
        return booking;
      });
    return this.countObjs === 1 ? (bookings[0] as any) : (bookings as any);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
