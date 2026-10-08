import { ForbiddenException } from "@nestjs/common";

import { Establishment } from "../../../../../establishment/domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../../establishment/infra/db/in-memory/establishment-in-memory.repository";
import { Event } from "../../../../../events/domain/event.aggregate";
import { EventAttendee } from "../../../../../events/domain/event-attendee.aggregate";
import { EventMusician } from "../../../../../events/domain/event-musician.aggregate";
import { EventAttendeeInMemoryRepository } from "../../../../../events/infra/db/in-memory/event-attendee-in-memory.repository";
import { EventInMemoryRepository } from "../../../../../events/infra/db/in-memory/event-in-memory.repository";
import { EventMusicianInMemoryRepository } from "../../../../../events/infra/db/in-memory/event-musician-in-memory.repository";
import { Musician } from "../../../../../musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { Booking } from "../../../../../scheduling/domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../../scheduling/infra/db/in-memory/booking-in-memory.repository";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { ReviewInMemoryRepository } from "../../../../infra/db/in-memory/review-in-memory.repository";
import { ReviewEligibilityService } from "../../../services/review-eligibility.service";
import { SubmitReviewUseCase } from "../submit-review.use-case";

describe("SubmitReviewUseCase Unit Tests", () => {
  let reviewRepo: ReviewInMemoryRepository;
  let musicianRepo: MusicianInMemoryRepository;
  let establishmentRepo: EstablishmentInMemoryRepository;
  let bookingRepo: BookingInMemoryRepository;
  let attendeeRepo: EventAttendeeInMemoryRepository;
  let eventRepo: EventInMemoryRepository;
  let eventMusicianRepo: EventMusicianInMemoryRepository;
  let useCase: SubmitReviewUseCase;

  let musician: Musician;
  let establishment: Establishment;
  let event: Event;
  let fanId: string;

  beforeEach(async () => {
    reviewRepo = new ReviewInMemoryRepository();
    musicianRepo = new MusicianInMemoryRepository();
    establishmentRepo = new EstablishmentInMemoryRepository();
    bookingRepo = new BookingInMemoryRepository();
    attendeeRepo = new EventAttendeeInMemoryRepository();
    eventRepo = new EventInMemoryRepository();
    eventMusicianRepo = new EventMusicianInMemoryRepository();

    useCase = new SubmitReviewUseCase(
      reviewRepo,
      new ReviewEligibilityService(
        bookingRepo,
        attendeeRepo,
        eventRepo,
        eventMusicianRepo,
      ),
      musicianRepo,
      establishmentRepo,
    );

    musician = Musician.fake().aMusician().build();
    await musicianRepo.insert(musician);

    establishment = Establishment.fake().anEstablishment().build();
    await establishmentRepo.insert(establishment);

    event = Event.fake()
      .anEvent()
      .withEstablishmentId(establishment.establishment_id)
      .build();
    await eventRepo.insert(event);

    fanId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  });

  async function fanAttended() {
    await attendeeRepo.insert(
      EventAttendee.create({
        event_id: event.entity_id.id,
        audience_id: fanId,
      }),
    );
  }

  async function musicianPerformed() {
    await eventMusicianRepo.insert(
      EventMusician.create({
        event_id: event.entity_id.id,
        musician_id: musician.musician_id.id,
      }),
    );
  }

  function fanRatesMusician(
    rating = 5,
    comment: string | null = "Show demais",
  ) {
    return {
      target_type: "musician" as const,
      target_id: musician.musician_id.id,
      author_type: "audience" as const,
      author_id: fanId,
      rating,
      comment,
      context_type: "event" as const,
      context_id: event.entity_id.id,
    };
  }

  describe("prova de vínculo (9.3c) — a defesa contra rating farming", () => {
    it("recusa fã que não esteve no evento", async () => {
      await musicianPerformed();

      await expect(useCase.execute(fanRatesMusician())).rejects.toThrow(
        ForbiddenException,
      );
      expect(reviewRepo.items).toHaveLength(0);
    });

    // Só presença não basta: senão um fã avalia qualquer músico do país usando
    // um evento qualquer que ele assistiu.
    it("recusa músico que não se apresentou naquele evento", async () => {
      await fanAttended();

      await expect(useCase.execute(fanRatesMusician())).rejects.toThrow(
        /não se apresentou/,
      );
      expect(reviewRepo.items).toHaveLength(0);
    });

    it("aceita quando o fã esteve presente E o músico se apresentou", async () => {
      await fanAttended();
      await musicianPerformed();

      const output = await useCase.execute(fanRatesMusician());

      expect(output.review.rating).toBe(5);
      expect(reviewRepo.items).toHaveLength(1);
    });

    it("recusa avaliar estabelecimento de outro evento", async () => {
      await fanAttended();
      const other = Establishment.fake().anEstablishment().build();
      await establishmentRepo.insert(other);

      await expect(
        useCase.execute({
          ...fanRatesMusician(),
          target_type: "establishment",
          target_id: other.establishment_id.id,
        }),
      ).rejects.toThrow(/não pertence ao estabelecimento/);
    });
  });

  describe("vínculo por booking (músico ↔ estabelecimento)", () => {
    async function completedBooking() {
      const booking = Booking.fake()
        .aBooking()
        .withEstablishmentId(establishment.establishment_id.id)
        .withMusicianId(musician.musician_id.id)
        .withBandId(null)
        .confirmed()
        .build();
      booking.complete(new Date());
      await bookingRepo.insert(booking);
      return booking;
    }

    it("recusa quando o show ainda não foi concluído", async () => {
      const booking = Booking.fake()
        .aBooking()
        .withEstablishmentId(establishment.establishment_id.id)
        .withMusicianId(musician.musician_id.id)
        .withBandId(null)
        .confirmed()
        .build();
      await bookingRepo.insert(booking);

      await expect(
        useCase.execute({
          target_type: "musician",
          target_id: musician.musician_id.id,
          author_type: "establishment",
          author_id: establishment.establishment_id.id,
          rating: 4,
          comment: null,
          context_type: "booking",
          context_id: booking.entity_id.id,
        }),
      ).rejects.toThrow(/conclusão do show/);
    });

    it("recusa quem não participou da reserva", async () => {
      const booking = await completedBooking();

      await expect(
        useCase.execute({
          target_type: "musician",
          target_id: musician.musician_id.id,
          author_type: "establishment",
          author_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          rating: 4,
          comment: null,
          context_type: "booking",
          context_id: booking.entity_id.id,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("unicidade e reavaliação (9.3c)", () => {
    beforeEach(async () => {
      await fanAttended();
      await musicianPerformed();
    });

    it("avaliar de novo o mesmo contexto atualiza em vez de duplicar", async () => {
      await useCase.execute(fanRatesMusician(5, "Show demais"));
      const output = await useCase.execute(
        fanRatesMusician(2, "Mudei de ideia"),
      );

      expect(reviewRepo.items).toHaveLength(1);
      expect(output.review.rating).toBe(2);
      expect(output.review.comment).toBe("Mudei de ideia");
    });

    // O ponto que o modelo de contador não conseguia: a nota antiga some.
    it("reavaliar NÃO soma duas vezes na projeção", async () => {
      await useCase.execute(fanRatesMusician(5));
      const output = await useCase.execute(fanRatesMusician(1));

      expect(output.target_rating).toEqual({ average: 1, total: 1 });

      const persisted = await musicianRepo.findById(musician.musician_id);
      expect(persisted!.rating.value).toBe(1);
      expect(persisted!.total_ratings).toBe(1);
    });
  });

  describe("projeção derivada do ledger", () => {
    it("média é recalculada sobre todas as avaliações", async () => {
      await fanAttended();
      await musicianPerformed();
      await useCase.execute(fanRatesMusician(5));

      // Segundo fã, mesmo evento e mesmo músico.
      const otherFan = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      await attendeeRepo.insert(
        EventAttendee.create({
          event_id: event.entity_id.id,
          audience_id: otherFan,
        }),
      );

      const output = await useCase.execute({
        ...fanRatesMusician(4),
        author_id: otherFan,
      });

      expect(output.target_rating).toEqual({ average: 4.5, total: 2 });

      const persisted = await musicianRepo.findById(musician.musician_id);
      expect(persisted!.rating.value).toBe(4.5);
      expect(persisted!.total_ratings).toBe(2);
    });
  });

  describe("validação", () => {
    beforeEach(async () => {
      await fanAttended();
      await musicianPerformed();
    });

    it.each([0, 6, 3.5])("rejeita nota inválida: %s", async (rating) => {
      await expect(
        useCase.execute(fanRatesMusician(rating as number)),
      ).rejects.toThrow(EntityValidationError);
    });

    it("404 quando o alvo não existe", async () => {
      await expect(
        useCase.execute({
          ...fanRatesMusician(),
          target_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
