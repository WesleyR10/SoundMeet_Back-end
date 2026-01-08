import { AggregateRoot, Uuid } from "../../shared/domain";
import {
  InquiryStatus,
  InquiryStatusEnum,
} from "../../shared/domain/value-objects/inquiry-status.vo";
import { InquiryAcceptedEvent } from "./events/inquiry-accepted.event";
import { InquiryConvertedEvent } from "./events/inquiry-converted.event";
import { InquiryCreatedEvent } from "./events/inquiry-created.event";
import { InquiryRejectedEvent } from "./events/inquiry-rejected.event";
import { InquiryValidatorFactory } from "./inquiry.validator";
import { InquiryFakeBuilder } from "./inquiry-fake.builder";

export class InquiryId extends Uuid {}

export type InquiryConstructorProps = {
  inquiry_id?: InquiryId;
  establishment_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  subject?: string | null;
  initial_message?: string | null;
  status?: InquiryStatus | string;
  expires_at?: Date | null;
  accepted_at?: Date | null;
  rejected_at?: Date | null;
  rejection_reason?: string | null;
  converted_at?: Date | null;
  booking_id?: string | null;
  created_at?: Date;
  updated_at?: Date;
};

export type InquiryCreateCommand = {
  establishment_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  subject?: string | null;
  initial_message?: string | null;
  expires_at?: Date | null;
};

export class Inquiry extends AggregateRoot {
  inquiry_id: InquiryId;
  establishment_id: Uuid;
  musician_id: Uuid | null;
  band_id: Uuid | null;
  event_id: Uuid | null;
  subject: string | null;
  initial_message: string | null;
  status: InquiryStatus;
  expires_at: Date | null;
  accepted_at: Date | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  converted_at: Date | null;
  booking_id: Uuid | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: InquiryConstructorProps) {
    super();
    this.inquiry_id = props.inquiry_id ?? new InquiryId();
    this.establishment_id = new Uuid(props.establishment_id);
    this.musician_id = props.musician_id ? new Uuid(props.musician_id) : null;
    this.band_id = props.band_id ? new Uuid(props.band_id) : null;
    this.event_id = props.event_id ? new Uuid(props.event_id) : null;
    this.subject = props.subject ?? null;
    this.initial_message = props.initial_message ?? null;
    this.status =
      props.status instanceof InquiryStatus
        ? props.status
        : InquiryStatus.create(props.status || InquiryStatusEnum.OPEN);
    this.expires_at = props.expires_at ?? null;
    this.accepted_at = props.accepted_at ?? null;
    this.rejected_at = props.rejected_at ?? null;
    this.rejection_reason = props.rejection_reason ?? null;
    this.converted_at = props.converted_at ?? null;
    this.booking_id = props.booking_id ? new Uuid(props.booking_id) : null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): InquiryId {
    return this.inquiry_id;
  }

  static create(props: InquiryCreateCommand): Inquiry {
    const inquiry = new Inquiry({
      ...props,
      expires_at:
        props.expires_at ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });
    inquiry.validate();
    if (inquiry.notification.hasErrors()) {
      return inquiry;
    }
    inquiry.applyEvent(
      new InquiryCreatedEvent({
        inquiry_id: inquiry.inquiry_id,
        establishment_id: inquiry.establishment_id.id,
        musician_id: inquiry.musician_id?.id ?? null,
        band_id: inquiry.band_id?.id ?? null,
        event_id: inquiry.event_id?.id ?? null,
        subject: inquiry.subject,
        expires_at: inquiry.expires_at,
        created_at: inquiry.created_at,
      }),
    );
    return inquiry;
  }

  expire(now: Date): void {
    if (!this.status.isOpen()) return;
    if (this.expires_at && now.getTime() >= this.expires_at.getTime()) {
      this.status = InquiryStatus.expired();
      this.updated_at = now;
    }
  }

  accept(now: Date): void {
    this.expire(now);
    if (!this.status.isOpen()) {
      this.notification.addError(
        "Only open inquiries can be accepted",
        "status",
      );
      return;
    }
    this.status = InquiryStatus.accepted();
    this.accepted_at = now;
    this.updated_at = now;
    this.applyEvent(
      new InquiryAcceptedEvent({
        inquiry_id: this.inquiry_id,
        accepted_at: now,
      }),
    );
  }

  reject(now: Date, reason?: string | null): void {
    this.expire(now);
    if (!this.status.isOpen()) {
      this.notification.addError(
        "Only open inquiries can be rejected",
        "status",
      );
      return;
    }
    this.status = InquiryStatus.rejected();
    this.rejected_at = now;
    this.rejection_reason = reason ?? null;
    this.updated_at = now;
    this.applyEvent(
      new InquiryRejectedEvent({
        inquiry_id: this.inquiry_id,
        rejected_at: now,
        reason: this.rejection_reason,
      }),
    );
  }

  convert(now: Date, booking_id: Uuid): void {
    this.expire(now);
    if (!this.status.isAccepted()) {
      this.notification.addError(
        "Only accepted inquiries can be converted",
        "status",
      );
      return;
    }
    this.status = InquiryStatus.converted();
    this.converted_at = now;
    this.booking_id = booking_id;
    this.updated_at = now;
    this.applyEvent(
      new InquiryConvertedEvent({
        inquiry_id: this.inquiry_id,
        booking_id: booking_id.id,
        converted_at: now,
      }),
    );
  }

  validate(fields?: string[]): boolean {
    const validator = InquiryValidatorFactory.create();
    validator.validate(this.notification, this, fields);

    const hasMusician = this.musician_id !== null;
    const hasBand = this.band_id !== null;
    if (hasMusician === hasBand) {
      this.notification.addError(
        "Either musician_id or band_id must be provided (exclusively)",
        "target",
      );
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

    if (this.status.isConverted() && !this.booking_id) {
      this.notification.addError(
        "booking_id is required when converted",
        "booking_id",
      );
    }

    return !this.notification.hasErrors();
  }

  static fake() {
    return InquiryFakeBuilder;
  }

  toJSON() {
    return {
      inquiry_id: this.inquiry_id.id,
      establishment_id: this.establishment_id.id,
      musician_id: this.musician_id?.id ?? null,
      band_id: this.band_id?.id ?? null,
      event_id: this.event_id?.id ?? null,
      subject: this.subject,
      initial_message: this.initial_message,
      status: this.status.value,
      expires_at: this.expires_at,
      accepted_at: this.accepted_at,
      rejected_at: this.rejected_at,
      rejection_reason: this.rejection_reason,
      converted_at: this.converted_at,
      booking_id: this.booking_id?.id ?? null,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
