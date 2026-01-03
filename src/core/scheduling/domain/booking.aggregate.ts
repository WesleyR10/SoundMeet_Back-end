import { AggregateRoot, Uuid } from "../../shared/domain";
import { ValueObject } from "../../shared/domain/value-object";
import {
  BookingStatus,
  BookingStatusEnum,
} from "../../shared/domain/value-objects/booking-status.vo";
import { BookingValidatorFactory } from "./booking.validator";
import { BookingFakeBuilder } from "./booking-fake.builder";
import { BookingCancelledEvent } from "./events/booking-cancelled.event";
import { BookingCompletedEvent } from "./events/booking-completed.event";
import { BookingConfirmedEvent } from "./events/booking-confirmed.event";
import { BookingProposedEvent } from "./events/booking-proposed.event";

export class BookingId extends Uuid {}

export type BookingConstructorProps = {
  id?: BookingId;
  establishment_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  start_at: Date;
  end_at: Date;
  fee?: number | null;
  notes?: string | null;
  status?: BookingStatus | string;
  buffer_minutes?: number;
  expires_at?: Date | null;
  free_cancellation_hours?: number;
  confirmed_at?: Date | null;
  cancelled_at?: Date | null;
  completed_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
};

export type BookingCreateCommand = {
  establishment_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  start_at: Date;
  end_at: Date;
  fee?: number | null;
  notes?: string | null;
  buffer_minutes?: number;
  expires_at?: Date | null;
  free_cancellation_hours?: number;
};

export class Booking extends AggregateRoot {
  id: BookingId;
  establishment_id: Uuid;
  musician_id: Uuid | null;
  band_id: Uuid | null;
  event_id: Uuid | null;
  start_at: Date;
  end_at: Date;
  fee: number | null;
  notes: string | null;
  status: BookingStatus;
  buffer_minutes: number;
  expires_at: Date | null;
  free_cancellation_hours: number;
  confirmed_at: Date | null;
  cancelled_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: BookingConstructorProps) {
    super();
    this.id = props.id ?? new BookingId();
    this.establishment_id = new Uuid(props.establishment_id);
    this.musician_id = props.musician_id ? new Uuid(props.musician_id) : null;
    this.band_id = props.band_id ? new Uuid(props.band_id) : null;
    this.event_id = props.event_id ? new Uuid(props.event_id) : null;
    this.start_at = props.start_at;
    this.end_at = props.end_at;
    this.fee = props.fee ?? null;
    this.notes = props.notes ?? null;
    this.status =
      props.status instanceof BookingStatus
        ? props.status
        : BookingStatus.create(props.status || BookingStatusEnum.PENDING);
    this.buffer_minutes = props.buffer_minutes ?? 0;
    this.expires_at = props.expires_at ?? null;
    this.free_cancellation_hours = props.free_cancellation_hours ?? 72;
    this.confirmed_at = props.confirmed_at ?? null;
    this.cancelled_at = props.cancelled_at ?? null;
    this.completed_at = props.completed_at ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): ValueObject {
    return this.id;
  }

  get bufferedStartAt(): Date {
    return new Date(this.start_at.getTime() - this.buffer_minutes * 60 * 1000);
  }

  get bufferedEndAt(): Date {
    return new Date(this.end_at.getTime() + this.buffer_minutes * 60 * 1000);
  }

  conflictsWith(booking: Booking): boolean {
    const startA = this.bufferedStartAt.getTime();
    const endA = this.bufferedEndAt.getTime();
    const startB = booking.bufferedStartAt.getTime();
    const endB = booking.bufferedEndAt.getTime();
    return startA < endB && startB < endA;
  }

  static create(props: BookingCreateCommand): Booking {
    const booking = new Booking(props);
    booking.validate();
    if (booking.notification.hasErrors()) {
      return booking;
    }
    booking.applyEvent(
      new BookingProposedEvent({
        booking_id: booking.id,
        establishment_id: booking.establishment_id.id,
        musician_id: booking.musician_id?.id ?? null,
        band_id: booking.band_id?.id ?? null,
        event_id: booking.event_id?.id ?? null,
        start_at: booking.start_at,
        end_at: booking.end_at,
        fee: booking.fee,
        status: booking.status,
        buffer_minutes: booking.buffer_minutes,
        expires_at: booking.expires_at,
        created_at: booking.created_at,
      }),
    );
    return booking;
  }

  expire(now: Date): void {
    if (!this.status.isPending()) {
      return;
    }
    if (this.expires_at && now.getTime() >= this.expires_at.getTime()) {
      this.status = BookingStatus.expired();
      this.updated_at = now;
    }
  }

  confirm(now: Date): void {
    this.expire(now);
    if (!this.status.isPending()) {
      this.notification.addError(
        "Only pending bookings can be confirmed",
        "status",
      );
      return;
    }
    this.status = BookingStatus.confirmed();
    this.confirmed_at = now;
    this.updated_at = now;
    this.applyEvent(
      new BookingConfirmedEvent({
        booking_id: this.id,
        confirmed_at: now,
      }),
    );
  }

  cancel(
    now: Date,
    cancelled_by: "establishment" | "musician" | "band",
    reason?: string | null,
  ): void {
    this.expire(now);

    if (this.status.isCancelled() || this.status.isCompleted()) {
      this.notification.addError(
        "Booking cannot be cancelled in current status",
        "status",
      );
      return;
    }

    if (this.status.isExpired()) {
      this.status = BookingStatus.cancelled();
      this.cancelled_at = now;
      this.updated_at = now;
      this.applyEvent(
        new BookingCancelledEvent({
          booking_id: this.id,
          cancelled_by,
          reason: reason ?? null,
          cancelled_at: now,
          booking_start_at: this.start_at,
        }),
      );
      return;
    }

    if (this.status.isConfirmed()) {
      const msUntilStart = this.start_at.getTime() - now.getTime();
      const hoursUntilStart = msUntilStart / (1000 * 60 * 60);
      const insidePenaltyWindow =
        hoursUntilStart < this.free_cancellation_hours;
      if (insidePenaltyWindow && (!reason || reason.trim().length === 0)) {
        this.notification.addError(
          "Cancellation reason is required within the penalty window",
          "reason",
        );
        return;
      }
    }

    this.status = BookingStatus.cancelled();
    this.cancelled_at = now;
    this.updated_at = now;
    this.applyEvent(
      new BookingCancelledEvent({
        booking_id: this.id,
        cancelled_by,
        reason: reason ?? null,
        cancelled_at: now,
        booking_start_at: this.start_at,
      }),
    );
  }

  complete(now: Date): void {
    if (!this.status.isConfirmed()) {
      this.notification.addError(
        "Only confirmed bookings can be completed",
        "status",
      );
      return;
    }
    this.status = BookingStatus.completed();
    this.completed_at = now;
    this.updated_at = now;
    this.applyEvent(
      new BookingCompletedEvent({
        booking_id: this.id,
        completed_at: now,
      }),
    );
  }

  validate(fields?: string[]): boolean {
    const validator = BookingValidatorFactory.create();
    validator.validate(this.notification, this, fields);

    const hasMusician = this.musician_id !== null;
    const hasBand = this.band_id !== null;
    if (hasMusician === hasBand) {
      this.notification.addError(
        "Either musician_id or band_id must be provided (exclusively)",
        "target",
      );
    }

    if (this.start_at && this.end_at) {
      if (this.end_at.getTime() <= this.start_at.getTime()) {
        this.notification.addError(
          "end_at must be greater than start_at",
          "end_at",
        );
      }
    }

    if (
      this.expires_at &&
      this.expires_at.getTime() <= this.created_at.getTime()
    ) {
      this.notification.addError(
        "expires_at must be greater than created_at",
        "expires_at",
      );
    }

    if (this.free_cancellation_hours < 0) {
      this.notification.addError(
        "free_cancellation_hours must be greater than or equal to 0",
        "free_cancellation_hours",
      );
    }

    return !this.notification.hasErrors();
  }

  static fake() {
    return BookingFakeBuilder;
  }

  toJSON() {
    return {
      id: this.id.id,
      establishment_id: this.establishment_id.id,
      musician_id: this.musician_id?.id ?? null,
      band_id: this.band_id?.id ?? null,
      event_id: this.event_id?.id ?? null,
      start_at: this.start_at,
      end_at: this.end_at,
      fee: this.fee,
      notes: this.notes,
      status: this.status.value,
      buffer_minutes: this.buffer_minutes,
      expires_at: this.expires_at,
      free_cancellation_hours: this.free_cancellation_hours,
      confirmed_at: this.confirmed_at,
      cancelled_at: this.cancelled_at,
      completed_at: this.completed_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
