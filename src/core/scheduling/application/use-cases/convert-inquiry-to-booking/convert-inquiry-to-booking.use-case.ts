import { IBandRepository } from "../../../../musician/domain/band.repository";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Booking } from "../../../domain/booking.aggregate";
import { IBookingRepository } from "../../../domain/booking.repository";
import { Inquiry, InquiryId } from "../../../domain/inquiry.aggregate";
import { IInquiryRepository } from "../../../domain/inquiry.repository";
import { BookingOutput, BookingOutputMapper } from "../common/booking-output";
import { assertNegotiationParticipant } from "../common/negotiation-actor";
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
    private readonly bookingDefaultFreeCancellationHours?: number,
    private readonly bandRepo?: IBandRepository,
  ) {}

  async execute(input: ConvertInquiryToBookingInput): Promise<BookingOutput> {
    const inquiryId = new InquiryId(input.inquiry_id);
    const inquiry = await this.inquiryRepo.findById(inquiryId);
    if (!inquiry) {
      throw new NotFoundError(input.inquiry_id, Inquiry);
    }

    // Converter uma inquiry aceita cria compromisso comercial: só as partes da
    // negociação podem fazê-lo, nunca um terceiro que descobriu o UUID.
    await assertNegotiationParticipant(
      input,
      {
        establishment_id: inquiry.establishment_id.id,
        musician_id: inquiry.musician_id?.id ?? null,
        band_id: inquiry.band_id?.id ?? null,
      },
      "converter esta negociação em booking",
      this.bandRepo,
    );

    inquiry.expire(this.clock.now());
    // `open` também: ver o JSDoc de `Inquiry.convert` — o aceite do artista
    // acontece no booking, que nasce pendente.
    if (!inquiry.status.isAccepted() && !inquiry.status.isOpen()) {
      inquiry.notification.addError(
        "Only open or accepted inquiries can be converted",
        "status",
      );
      throw new EntityValidationError(inquiry.notification.toJSON());
    }

    const booking = Booking.create({
      /*
       * 🔴 A origem viaja no evento para o chat NÃO abrir uma segunda conversa.
       *
       * Esta inquiry já tem canal aberto (`InquiryCreatedEvent` →
       * `OpenConversationUseCase`). Como a conversão também chama
       * `Booking.create`, ela emite `BookingProposedEvent` — e desde 17/set o
       * chat reage a esse evento. Sem esta linha, a negociação ficaria partida
       * em dois fios sem nada ligando um ao outro.
       */
      from_inquiry_id: inquiry.inquiry_id.id,
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
      /*
       * Quem converteu é quem propôs — e é isso que diz aos clientes de quem é
       * a vez de responder. Antes a conversão deixava `proposed_by` nulo, e o
       * app não tinha como saber se o booking esperava o artista.
       */
      proposed_by: input.proposed_by ?? null,
      ...(this.bookingDefaultFreeCancellationHours !== undefined
        ? { free_cancellation_hours: this.bookingDefaultFreeCancellationHours }
        : {}),
    });

    if (booking.notification.hasErrors()) {
      throw new EntityValidationError(booking.notification.toJSON());
    }

    await this.bookingRepo.insert(booking);

    inquiry.convert(this.clock.now(), booking.booking_id);
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
