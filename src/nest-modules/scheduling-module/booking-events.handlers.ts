import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { BookingCancelledEvent } from "../../core/scheduling/domain/events/booking-cancelled.event";
import { BookingCancelledIntegrationEvent } from "../../core/scheduling/domain/events/booking-cancelled.event";
import {
  BookingCompletedEvent,
  BookingCompletedIntegrationEvent,
} from "../../core/scheduling/domain/events/booking-completed.event";
import {
  BookingConfirmedEvent,
  BookingConfirmedIntegrationEvent,
} from "../../core/scheduling/domain/events/booking-confirmed.event";
import {
  BookingProposedEvent,
  BookingProposedIntegrationEvent,
} from "../../core/scheduling/domain/events/booking-proposed.event";
import { InquiryAcceptedEvent } from "../../core/scheduling/domain/events/inquiry-accepted.event";
import { InquiryAcceptedIntegrationEvent } from "../../core/scheduling/domain/events/inquiry-accepted.event";
import { InquiryConvertedEvent } from "../../core/scheduling/domain/events/inquiry-converted.event";
import { InquiryConvertedIntegrationEvent } from "../../core/scheduling/domain/events/inquiry-converted.event";
import { InquiryCreatedEvent } from "../../core/scheduling/domain/events/inquiry-created.event";
import { InquiryCreatedIntegrationEvent } from "../../core/scheduling/domain/events/inquiry-created.event";
import { InquiryRejectedEvent } from "../../core/scheduling/domain/events/inquiry-rejected.event";
import { InquiryRejectedIntegrationEvent } from "../../core/scheduling/domain/events/inquiry-rejected.event";

@Injectable()
export class BookingEventsHandlers {
  private readonly logger = new Logger(BookingEventsHandlers.name);

  @OnEvent(BookingProposedEvent.name)
  handleBookingProposed(event: BookingProposedEvent) {
    this.logger.log(
      JSON.stringify({
        event: "booking.proposed",
        booking_id: event.aggregate_id.id,
        establishment_id: event.establishment_id,
        musician_id: event.musician_id,
        band_id: event.band_id,
        event_id: event.event_id,
        start_at: event.start_at,
        end_at: event.end_at,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(BookingConfirmedEvent.name)
  handleBookingConfirmed(event: BookingConfirmedEvent) {
    this.logger.log(
      JSON.stringify({
        event: "booking.confirmed",
        booking_id: event.aggregate_id.id,
        confirmed_at: event.confirmed_at,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(BookingCancelledEvent.name)
  handleBookingCancelled(event: BookingCancelledEvent) {
    this.logger.log(
      JSON.stringify({
        event: "booking.cancelled",
        booking_id: event.aggregate_id.id,
        cancelled_by: event.cancelled_by,
        cancelled_at: event.cancelled_at,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(BookingCompletedEvent.name)
  handleBookingCompleted(event: BookingCompletedEvent) {
    this.logger.log(
      JSON.stringify({
        event: "booking.completed",
        booking_id: event.aggregate_id.id,
        completed_at: event.completed_at,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(BookingConfirmedIntegrationEvent.name)
  handleBookingConfirmedIntegration(event: BookingConfirmedIntegrationEvent) {
    this.logger.log(
      JSON.stringify({
        event: event.event_name,
        booking_id: event.payload.booking_id,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(BookingCompletedIntegrationEvent.name)
  handleBookingCompletedIntegration(event: BookingCompletedIntegrationEvent) {
    this.logger.log(
      JSON.stringify({
        event: event.event_name,
        booking_id: event.payload.booking_id,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(BookingProposedIntegrationEvent.name)
  handleBookingProposedIntegration(event: BookingProposedIntegrationEvent) {
    this.logger.log(
      JSON.stringify({
        event: event.event_name,
        booking_id: event.payload.booking_id,
        establishment_id: event.payload.establishment_id,
        musician_id: event.payload.musician_id,
        band_id: event.payload.band_id,
        event_id: event.payload.event_id,
        start_at: event.payload.start_at,
        end_at: event.payload.end_at,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(BookingCancelledIntegrationEvent.name)
  handleBookingCancelledIntegration(event: BookingCancelledIntegrationEvent) {
    this.logger.log(
      JSON.stringify({
        event: event.event_name,
        booking_id: event.payload.booking_id,
        cancelled_by: event.payload.cancelled_by,
        cancelled_at: event.payload.cancelled_at,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(InquiryCreatedEvent.name)
  handleInquiryCreated(event: InquiryCreatedEvent) {
    this.logger.log(
      JSON.stringify({
        event: "inquiry.created",
        inquiry_id: event.aggregate_id.id,
        establishment_id: event.establishment_id,
        musician_id: event.musician_id,
        band_id: event.band_id,
        event_id: event.event_id,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(InquiryAcceptedEvent.name)
  handleInquiryAccepted(event: InquiryAcceptedEvent) {
    this.logger.log(
      JSON.stringify({
        event: "inquiry.accepted",
        inquiry_id: event.aggregate_id.id,
        accepted_at: event.accepted_at,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(InquiryRejectedEvent.name)
  handleInquiryRejected(event: InquiryRejectedEvent) {
    this.logger.log(
      JSON.stringify({
        event: "inquiry.rejected",
        inquiry_id: event.aggregate_id.id,
        rejected_at: event.rejected_at,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(InquiryConvertedEvent.name)
  handleInquiryConverted(event: InquiryConvertedEvent) {
    this.logger.log(
      JSON.stringify({
        event: "inquiry.converted",
        inquiry_id: event.aggregate_id.id,
        booking_id: event.booking_id,
        converted_at: event.converted_at,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(InquiryCreatedIntegrationEvent.name)
  handleInquiryCreatedIntegration(event: InquiryCreatedIntegrationEvent) {
    this.logger.log(
      JSON.stringify({
        event: event.event_name,
        inquiry_id: event.payload.inquiry_id,
        establishment_id: event.payload.establishment_id,
        musician_id: event.payload.musician_id,
        band_id: event.payload.band_id,
        event_id: event.payload.event_id,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(InquiryAcceptedIntegrationEvent.name)
  handleInquiryAcceptedIntegration(event: InquiryAcceptedIntegrationEvent) {
    this.logger.log(
      JSON.stringify({
        event: event.event_name,
        inquiry_id: event.payload.inquiry_id,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(InquiryRejectedIntegrationEvent.name)
  handleInquiryRejectedIntegration(event: InquiryRejectedIntegrationEvent) {
    this.logger.log(
      JSON.stringify({
        event: event.event_name,
        inquiry_id: event.payload.inquiry_id,
        occurred_on: event.occurred_on,
      }),
    );
  }

  @OnEvent(InquiryConvertedIntegrationEvent.name)
  handleInquiryConvertedIntegration(event: InquiryConvertedIntegrationEvent) {
    this.logger.log(
      JSON.stringify({
        event: event.event_name,
        inquiry_id: event.payload.inquiry_id,
        booking_id: event.payload.booking_id,
        occurred_on: event.occurred_on,
      }),
    );
  }
}
