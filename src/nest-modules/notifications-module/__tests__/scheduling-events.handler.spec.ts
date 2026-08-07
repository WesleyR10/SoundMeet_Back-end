import { Establishment } from "../../../core/establishment/domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../core/establishment/infra/db/in-memory/establishment-in-memory.repository";
import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { Booking } from "../../../core/scheduling/domain/booking.aggregate";
import { BookingCancelledEvent } from "../../../core/scheduling/domain/events/booking-cancelled.event";
import { BookingConfirmedEvent } from "../../../core/scheduling/domain/events/booking-confirmed.event";
import { InquiryCreatedEvent } from "../../../core/scheduling/domain/events/inquiry-created.event";
import { Inquiry } from "../../../core/scheduling/domain/inquiry.aggregate";
import { BookingInMemoryRepository } from "../../../core/scheduling/infra/db/in-memory/booking-in-memory.repository";
import { InquiryInMemoryRepository } from "../../../core/scheduling/infra/db/in-memory/inquiry-in-memory.repository";
import { NotificationsSchedulingEventsHandler } from "../scheduling-events.handler";

describe("NotificationsSchedulingEventsHandler (Bloco 9.5)", () => {
  let handler: NotificationsSchedulingEventsHandler;
  let gateway: any;
  let mailService: any;
  let push: any;
  let bookingRepo: BookingInMemoryRepository;
  let inquiryRepo: InquiryInMemoryRepository;
  let musicianRepo: MusicianInMemoryRepository;
  let establishmentRepo: EstablishmentInMemoryRepository;

  let musician: Musician;
  let establishment: Establishment;
  let booking: Booking;

  beforeEach(async () => {
    gateway = {
      notifyBookingUpdate: jest.fn(),
      notifyEstablishmentBookingUpdate: jest.fn(),
      notifyInquiryUpdate: jest.fn(),
      notifyEstablishmentInquiryUpdate: jest.fn(),
    };
    mailService = {
      sendBookingConfirmed: jest.fn().mockResolvedValue(undefined),
      sendBookingCancelled: jest.fn().mockResolvedValue(undefined),
    };
    push = { send: jest.fn().mockResolvedValue(undefined) };

    bookingRepo = new BookingInMemoryRepository();
    inquiryRepo = new InquiryInMemoryRepository();
    musicianRepo = new MusicianInMemoryRepository();
    establishmentRepo = new EstablishmentInMemoryRepository();

    handler = new NotificationsSchedulingEventsHandler(
      gateway,
      mailService,
      push,
      bookingRepo,
      inquiryRepo,
      musicianRepo,
      establishmentRepo,
    );

    musician = Musician.fake().aMusician().build();
    await musicianRepo.insert(musician);

    establishment = Establishment.fake().anEstablishment().build();
    await establishmentRepo.insert(establishment);

    booking = Booking.fake()
      .aBooking()
      .withEstablishmentId(establishment.establishment_id.id)
      .withMusicianId(musician.musician_id.id)
      .withBandId(null)
      .confirmed()
      .build();
    await bookingRepo.insert(booking);
  });

  function confirmedEvent() {
    return {
      aggregate_id: booking.entity_id,
      confirmed_at: new Date(),
      occurred_on: new Date(),
    } as unknown as BookingConfirmedEvent;
  }

  describe("booking → e-mail (comprovante) + tempo real", () => {
    it("avisa músico e estabelecimento pelo socket", async () => {
      await handler.handleBookingConfirmed(confirmedEvent());

      expect(gateway.notifyBookingUpdate).toHaveBeenCalledWith(
        musician.musician_id.id,
        expect.objectContaining({ status: "confirmed" }),
      );
      expect(gateway.notifyEstablishmentBookingUpdate).toHaveBeenCalledWith(
        establishment.establishment_id.id,
        expect.objectContaining({ status: "confirmed" }),
      );
    });

    // Booking é comprovante: os DOIS lados precisam do registro por e-mail.
    it("envia e-mail para os dois lados", async () => {
      await handler.handleBookingConfirmed(confirmedEvent());

      expect(mailService.sendBookingConfirmed).toHaveBeenCalledTimes(2);
      const destinatarios = mailService.sendBookingConfirmed.mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(destinatarios).toEqual(
        expect.arrayContaining([
          musician.email.value,
          establishment.email.value,
        ]),
      );
    });

    it("usa o template de cancelamento no cancelamento", async () => {
      await handler.handleBookingCancelled({
        aggregate_id: booking.entity_id,
        cancelled_by: "establishment",
        cancelled_at: new Date(),
        occurred_on: new Date(),
      } as unknown as BookingCancelledEvent);

      expect(mailService.sendBookingCancelled).toHaveBeenCalledTimes(2);
      expect(mailService.sendBookingConfirmed).not.toHaveBeenCalled();
    });

    // Falha de e-mail não pode desfazer um booking já commitado.
    it("não propaga erro quando o e-mail falha", async () => {
      mailService.sendBookingConfirmed.mockRejectedValue(new Error("smtp"));

      await expect(
        handler.handleBookingConfirmed(confirmedEvent()),
      ).resolves.toBeUndefined();

      // O socket já saiu antes do e-mail — o dashboard atualiza mesmo assim.
      expect(gateway.notifyEstablishmentBookingUpdate).toHaveBeenCalled();
    });

    it("booking inexistente é no-op silencioso", async () => {
      await handler.handleBookingCancelled({
        aggregate_id: { id: "99999999-9999-4999-8999-999999999999" },
        cancelled_by: null,
        cancelled_at: new Date(),
        occurred_on: new Date(),
      } as unknown as BookingCancelledEvent);

      expect(gateway.notifyBookingUpdate).not.toHaveBeenCalled();
      expect(mailService.sendBookingCancelled).not.toHaveBeenCalled();
    });
  });

  describe("inquiry → tempo real, sem e-mail", () => {
    it("notifica o músico da proposta nova e NÃO manda e-mail", async () => {
      await handler.handleInquiryCreated({
        aggregate_id: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
        establishment_id: establishment.establishment_id.id,
        musician_id: musician.musician_id.id,
        band_id: null,
        subject: "Sexta 22h",
        occurred_on: new Date(),
      } as unknown as InquiryCreatedEvent);

      expect(gateway.notifyInquiryUpdate).toHaveBeenCalledWith(
        musician.musician_id.id,
        expect.objectContaining({ status: "created" }),
      );
      expect(mailService.sendBookingConfirmed).not.toHaveBeenCalled();
    });

    it("aceite avisa o estabelecimento, que está esperando no dashboard", async () => {
      const inquiry = Inquiry.fake()
        .anInquiry()
        .withEstablishmentId(establishment.establishment_id.id)
        .withMusicianId(musician.musician_id.id)
        .withBandId(null)
        .build();
      await inquiryRepo.insert(inquiry);

      await handler.handleInquiryAccepted({
        aggregate_id: inquiry.entity_id,
        accepted_at: new Date(),
        occurred_on: new Date(),
      } as never);

      expect(gateway.notifyEstablishmentInquiryUpdate).toHaveBeenCalledWith(
        establishment.establishment_id.id,
        expect.objectContaining({ status: "accepted" }),
      );
    });
  });
});
