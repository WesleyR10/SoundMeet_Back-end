import { Establishment } from "../../../core/establishment/domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../core/establishment/infra/db/in-memory/establishment-in-memory.repository";
import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { Booking } from "../../../core/scheduling/domain/booking.aggregate";
import { BookingCancelledEvent } from "../../../core/scheduling/domain/events/booking-cancelled.event";
import { BookingConfirmedEvent } from "../../../core/scheduling/domain/events/booking-confirmed.event";
import { BookingProposalRevisedEvent } from "../../../core/scheduling/domain/events/booking-proposal-revised.event";
import { BookingProposedEvent } from "../../../core/scheduling/domain/events/booking-proposed.event";
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

  describe("proposta de show → tempo real + push para o artista (18/set/2026)", () => {
    const TOKEN = "ExponentPushToken[abc123]";

    beforeEach(async () => {
      musician.push_token = TOKEN;
      await musicianRepo.update(musician);
    });

    function proposed(overrides: Partial<{ from_inquiry_id: string | null; musician_id: string | null }> = {}) {
      return {
        aggregate_id: booking.entity_id,
        from_inquiry_id: null,
        establishment_id: establishment.establishment_id.id,
        musician_id: musician.musician_id.id,
        band_id: null,
        start_at: new Date("2026-10-02T01:00:00Z"),
        end_at: new Date("2026-10-02T04:00:00Z"),
        ...overrides,
      } as unknown as BookingProposedEvent;
    }

    it("🔴 avisa o artista de uma proposta DIRETA — antes nada era enviado", async () => {
      await handler.handleBookingProposed(proposed());

      expect(gateway.notifyBookingUpdate).toHaveBeenCalledWith(
        musician.musician_id.id,
        expect.objectContaining({ status: "proposed" }),
      );
      expect(push.send).toHaveBeenCalledWith(
        TOKEN,
        expect.objectContaining({
          title: "Nova proposta de show 🎤",
          body: expect.stringContaining("te mandou uma proposta"),
          data: expect.objectContaining({ type: "booking.proposed" }),
        }),
      );
      // Negociação, não comprovante: e-mail só na confirmação.
      expect(mailService.sendBookingConfirmed).not.toHaveBeenCalled();
    });

    it("diz que a CONVERSA virou proposta quando veio de uma inquiry", async () => {
      await handler.handleBookingProposed(
        proposed({ from_inquiry_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
      );

      expect(push.send).toHaveBeenCalledWith(
        TOKEN,
        expect.objectContaining({
          body: expect.stringContaining("transformou a conversa"),
        }),
      );
    });

    it("não avisa ninguém em booking de BANDA — o token é do músico", async () => {
      await handler.handleBookingProposed(proposed({ musician_id: null }));

      expect(gateway.notifyBookingUpdate).not.toHaveBeenCalled();
      expect(push.send).not.toHaveBeenCalled();
    });

    function revised(proposed_by: string, previous_status: string) {
      return {
        aggregate_id: booking.entity_id,
        establishment_id: establishment.establishment_id.id,
        musician_id: musician.musician_id.id,
        band_id: null,
        start_at: new Date("2026-10-03T01:00:00Z"),
        end_at: new Date("2026-10-03T04:00:00Z"),
        fee: 900,
        proposed_by,
        previous_status,
        expires_at: null,
        revised_at: new Date(),
      } as unknown as BookingProposalRevisedEvent;
    }

    it("avisa a nova oferta depois de uma recusa com texto próprio", async () => {
      await handler.handleBookingProposalRevised(
        revised("establishment", "cancelled"),
      );

      expect(gateway.notifyBookingUpdate).toHaveBeenCalledWith(
        musician.musician_id.id,
        expect.objectContaining({ status: "revised" }),
      );
      expect(push.send).toHaveBeenCalledWith(
        TOKEN,
        expect.objectContaining({
          title: "Proposta atualizada 🎤",
          body: expect.stringContaining("nova proposta depois da sua resposta"),
        }),
      );
    });

    it("contraproposta feita PELO artista não notifica o próprio artista", async () => {
      await handler.handleBookingProposalRevised(
        revised("musician", "pending"),
      );

      expect(gateway.notifyBookingUpdate).not.toHaveBeenCalled();
      expect(push.send).not.toHaveBeenCalled();
    });
  });
});
