import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Booking } from "../../../domain/booking.aggregate";
import { IBookingRepository } from "../../../domain/booking.repository";
import { Inquiry, InquiryId } from "../../../domain/inquiry.aggregate";
import { IInquiryRepository } from "../../../domain/inquiry.repository";
import { BookingOutput, BookingOutputMapper } from "../common/booking-output";
import { ConvertInquiryToBookingInput } from "./convert-inquiry-to-booking.input";

export class ConvertInquiryToBookingUseCase implements IUseCase<
  ConvertInquiryToBookingInput,
  BookingOutput
> {
  constructor(
    private readonly inquiryRepo: IInquiryRepository,
    private readonly bookingRepo: IBookingRepository,
    private readonly clock: IClock = { now: () => new Date() },
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: ConvertInquiryToBookingInput): Promise<BookingOutput> {
    const inquiryId = new InquiryId(input.inquiry_id);
    const inquiry = await this.inquiryRepo.findById(inquiryId);
    if (!inquiry) {
      throw new NotFoundError(input.inquiry_id, Inquiry);
    }

    inquiry.expire(this.clock.now());
    if (!inquiry.status.isAccepted()) {
      inquiry.notification.addError(
        "Only accepted inquiries can be converted",
        "status",
      );
      throw new EntityValidationError(inquiry.notification.toJSON());
    }

    const booking = Booking.create({
      establishment_id: inquiry.establishment_id.id,
      musician_id: inquiry.musician_id?.id ?? null,
      band_id: inquiry.band_id?.id ?? null,
      event_id: inquiry.event_id?.id ?? null,
      start_at: input.start_at,
      end_at: input.end_at,
      fee: input.fee ?? null,
      notes: input.notes ?? null,
      buffer_minutes: input.buffer_minutes ?? 0,
      expires_at: input.expires_at ?? null,
      free_cancellation_hours: input.free_cancellation_hours ?? 72,
    });

    if (booking.notification.hasErrors()) {
      throw new EntityValidationError(booking.notification.toJSON());
    }

    await this.bookingRepo.insert(booking);

    inquiry.convert(this.clock.now(), booking.id);
    if (inquiry.notification.hasErrors()) {
      throw new EntityValidationError(inquiry.notification.toJSON());
    }
    await this.inquiryRepo.update(inquiry);

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(booking);
      await this.domainEventMediator.publishIntegrationEvents(booking);
      booking.clearEvents();

      await this.domainEventMediator.publish(inquiry);
      await this.domainEventMediator.publishIntegrationEvents(inquiry);
      inquiry.clearEvents();
    }

    return BookingOutputMapper.toOutput(booking);
  }
}
