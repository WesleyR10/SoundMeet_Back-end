import { BookingId } from "../../../core/scheduling/domain/booking.aggregate";
import {
  BookingCancelledEvent,
  BookingCancelledIntegrationEvent,
} from "../../../core/scheduling/domain/events/booking-cancelled.event";
import {
  BookingCompletedEvent,
  BookingCompletedIntegrationEvent,
} from "../../../core/scheduling/domain/events/booking-completed.event";
import {
  BookingConfirmedEvent,
  BookingConfirmedIntegrationEvent,
} from "../../../core/scheduling/domain/events/booking-confirmed.event";
import {
  BookingProposedEvent,
  BookingProposedIntegrationEvent,
} from "../../../core/scheduling/domain/events/booking-proposed.event";
import { InquiryAcceptedEvent } from "../../../core/scheduling/domain/events/inquiry-accepted.event";
import { InquiryAcceptedIntegrationEvent } from "../../../core/scheduling/domain/events/inquiry-accepted.event";
import { InquiryConvertedEvent } from "../../../core/scheduling/domain/events/inquiry-converted.event";
import { InquiryConvertedIntegrationEvent } from "../../../core/scheduling/domain/events/inquiry-converted.event";
import { InquiryCreatedEvent } from "../../../core/scheduling/domain/events/inquiry-created.event";
import { InquiryCreatedIntegrationEvent } from "../../../core/scheduling/domain/events/inquiry-created.event";
import { InquiryRejectedEvent } from "../../../core/scheduling/domain/events/inquiry-rejected.event";
import { InquiryRejectedIntegrationEvent } from "../../../core/scheduling/domain/events/inquiry-rejected.event";
import { InquiryId } from "../../../core/scheduling/domain/inquiry.aggregate";
import { BookingEventsHandlers } from "../booking-events.handlers";

describe("BookingEventsHandlers", () => {
  let handler: BookingEventsHandlers;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    handler = new BookingEventsHandlers();
    logSpy = jest
      .spyOn((handler as any).logger, "log")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("loga BookingProposedEvent", () => {
    const bookingId = new BookingId();
    handler.handleBookingProposed(
      new BookingProposedEvent({
        booking_id: bookingId,
        establishment_id: "est-1",
        musician_id: "mus-1",
        band_id: null,
        event_id: null,
        start_at: new Date(),
        end_at: new Date(),
        fee: 100,
        status: "pending" as any,
        buffer_minutes: 0,
        expires_at: null,
        created_at: new Date(),
      }),
    );
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain("booking.proposed");
  });

  it("loga BookingConfirmedEvent", () => {
    handler.handleBookingConfirmed(
      new BookingConfirmedEvent({
        booking_id: new BookingId(),
        confirmed_at: new Date(),
      }),
    );
    expect(logSpy.mock.calls[0][0]).toContain("booking.confirmed");
  });

  it("loga BookingCancelledEvent", () => {
    handler.handleBookingCancelled(
      new BookingCancelledEvent({
        booking_id: new BookingId(),
        cancelled_by: "establishment",
        reason: "motivo",
        cancelled_at: new Date(),
        booking_start_at: new Date(),
      }),
    );
    expect(logSpy.mock.calls[0][0]).toContain("booking.cancelled");
  });

  it("loga BookingCompletedEvent", () => {
    handler.handleBookingCompleted(
      new BookingCompletedEvent({
        booking_id: new BookingId(),
        completed_at: new Date(),
      }),
    );
    expect(logSpy.mock.calls[0][0]).toContain("booking.completed");
  });

  it("loga BookingConfirmedIntegrationEvent", () => {
    const event = new BookingConfirmedEvent({
      booking_id: new BookingId(),
      confirmed_at: new Date(),
    }).getIntegrationEvent() as BookingConfirmedIntegrationEvent;
    handler.handleBookingConfirmedIntegration(event);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("loga BookingCompletedIntegrationEvent", () => {
    const event = new BookingCompletedEvent({
      booking_id: new BookingId(),
      completed_at: new Date(),
    }).getIntegrationEvent() as BookingCompletedIntegrationEvent;
    handler.handleBookingCompletedIntegration(event);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("loga BookingProposedIntegrationEvent", () => {
    const event = new BookingProposedEvent({
      booking_id: new BookingId(),
      establishment_id: "est-1",
      musician_id: null,
      band_id: "band-1",
      event_id: null,
      start_at: new Date(),
      end_at: new Date(),
      fee: null,
      status: "pending" as any,
      buffer_minutes: 0,
      expires_at: null,
      created_at: new Date(),
    }).getIntegrationEvent() as BookingProposedIntegrationEvent;
    handler.handleBookingProposedIntegration(event);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("loga BookingCancelledIntegrationEvent", () => {
    const event = new BookingCancelledEvent({
      booking_id: new BookingId(),
      cancelled_by: "musician",
      reason: null,
      cancelled_at: new Date(),
      booking_start_at: new Date(),
    }).getIntegrationEvent() as BookingCancelledIntegrationEvent;
    handler.handleBookingCancelledIntegration(event);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("loga InquiryCreatedEvent", () => {
    handler.handleInquiryCreated(
      new InquiryCreatedEvent({
        inquiry_id: new InquiryId(),
        establishment_id: "est-1",
        musician_id: "mus-1",
        band_id: null,
        event_id: null,
        subject: null,
        expires_at: null,
        created_at: new Date(),
      }),
    );
    expect(logSpy.mock.calls[0][0]).toContain("inquiry.created");
  });

  it("loga InquiryAcceptedEvent", () => {
    handler.handleInquiryAccepted(
      new InquiryAcceptedEvent({
        inquiry_id: new InquiryId(),
        accepted_at: new Date(),
      }),
    );
    expect(logSpy.mock.calls[0][0]).toContain("inquiry.accepted");
  });

  it("loga InquiryRejectedEvent", () => {
    handler.handleInquiryRejected(
      new InquiryRejectedEvent({
        inquiry_id: new InquiryId(),
        rejected_at: new Date(),
        reason: null,
      }),
    );
    expect(logSpy.mock.calls[0][0]).toContain("inquiry.rejected");
  });

  it("loga InquiryConvertedEvent", () => {
    handler.handleInquiryConverted(
      new InquiryConvertedEvent({
        inquiry_id: new InquiryId(),
        booking_id: new BookingId().id,
        converted_at: new Date(),
      }),
    );
    expect(logSpy.mock.calls[0][0]).toContain("inquiry.converted");
  });

  it("loga InquiryCreatedIntegrationEvent", () => {
    const event = new InquiryCreatedEvent({
      inquiry_id: new InquiryId(),
      establishment_id: "est-1",
      musician_id: "mus-1",
      band_id: null,
      event_id: null,
      subject: null,
      expires_at: null,
      created_at: new Date(),
    }).getIntegrationEvent() as InquiryCreatedIntegrationEvent;
    handler.handleInquiryCreatedIntegration(event);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("loga InquiryAcceptedIntegrationEvent", () => {
    const event = new InquiryAcceptedEvent({
      inquiry_id: new InquiryId(),
      accepted_at: new Date(),
    }).getIntegrationEvent() as InquiryAcceptedIntegrationEvent;
    handler.handleInquiryAcceptedIntegration(event);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("loga InquiryRejectedIntegrationEvent", () => {
    const event = new InquiryRejectedEvent({
      inquiry_id: new InquiryId(),
      rejected_at: new Date(),
      reason: null,
    }).getIntegrationEvent() as InquiryRejectedIntegrationEvent;
    handler.handleInquiryRejectedIntegration(event);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("loga InquiryConvertedIntegrationEvent", () => {
    const event = new InquiryConvertedEvent({
      inquiry_id: new InquiryId(),
      booking_id: new BookingId().id,
      converted_at: new Date(),
    }).getIntegrationEvent() as InquiryConvertedIntegrationEvent;
    handler.handleInquiryConvertedIntegration(event);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
