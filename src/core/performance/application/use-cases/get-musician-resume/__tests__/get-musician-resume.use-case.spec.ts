import { Establishment } from "../../../../../establishment/domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../../establishment/infra/db/in-memory/establishment-in-memory.repository";
import { EventAttendee } from "../../../../../events/domain/event-attendee.aggregate";
import { EventAttendeeInMemoryRepository } from "../../../../../events/infra/db/in-memory/event-attendee-in-memory.repository";
import { Musician } from "../../../../../musician/domain/musician.aggregate";
import { BandInMemoryRepository } from "../../../../../musician/infra/db/in-memory/band-in-memory.repository";
import { MusicianInMemoryRepository } from "../../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { Review } from "../../../../../review/domain/review.aggregate";
import { ReviewInMemoryRepository } from "../../../../../review/infra/db/in-memory/review-in-memory.repository";
import { Booking } from "../../../../../scheduling/domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../../scheduling/infra/db/in-memory/booking-in-memory.repository";
import { Uuid } from "../../../../../shared/domain";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Performance } from "../../../../domain/performance.aggregate";
import { PerformanceInMemoryRepository } from "../../../../infra/db/in-memory/performance-in-memory.repository";
import { GetMusicianResumeUseCase } from "../get-musician-resume.use-case";

describe("GetMusicianResumeUseCase", () => {
  let musicianRepo: MusicianInMemoryRepository;
  let bandRepo: BandInMemoryRepository;
  let bookingRepo: BookingInMemoryRepository;
  let establishmentRepo: EstablishmentInMemoryRepository;
  let attendeeRepo: EventAttendeeInMemoryRepository;
  let reviewRepo: ReviewInMemoryRepository;
  let performanceRepo: PerformanceInMemoryRepository;
  let useCase: GetMusicianResumeUseCase;

  let musician: Musician;
  let establishment: Establishment;

  beforeEach(async () => {
    musicianRepo = new MusicianInMemoryRepository();
    bandRepo = new BandInMemoryRepository();
    bookingRepo = new BookingInMemoryRepository();
    establishmentRepo = new EstablishmentInMemoryRepository();
    attendeeRepo = new EventAttendeeInMemoryRepository();
    reviewRepo = new ReviewInMemoryRepository();
    performanceRepo = new PerformanceInMemoryRepository();

    useCase = new GetMusicianResumeUseCase(
      musicianRepo,
      bandRepo,
      bookingRepo,
      establishmentRepo,
      attendeeRepo,
      reviewRepo,
      performanceRepo,
    );

    musician = Musician.fake().aMusician().build();
    await musicianRepo.insert(musician);

    establishment = Establishment.fake().anEstablishment().build();
    await establishmentRepo.insert(establishment);
  });

  async function aCompletedBooking(
    opts: {
      event_id?: string;
      checked_in?: boolean;
      completed_at?: Date;
    } = {},
  ) {
    const booking = Booking.fake()
      .aBooking()
      .withMusicianId(new Uuid(musician.musician_id.id))
      .withEstablishmentId(new Uuid(establishment.establishment_id.id))
      .build();

    booking.status = { value: "completed" } as never;
    (booking as unknown as { completed_at: Date | null }).completed_at =
      opts.completed_at ?? new Date("2026-05-10T22:00:00.000Z");
    if (opts.event_id) {
      (booking as unknown as { event_id: Uuid | null }).event_id = new Uuid(
        opts.event_id,
      );
    }
    if (opts.checked_in) {
      (booking as unknown as { checked_in_at: Date | null }).checked_in_at =
        new Date("2026-05-10T21:50:00.000Z");
    }

    await bookingRepo.insert(booking);
    return booking;
  }

  it("músico inexistente é 404", async () => {
    await expect(
      useCase.execute({ musician_id: new Uuid().id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("currículo vazio é zero em tudo, não erro", async () => {
    const resume = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    expect(resume.shows_completed).toBe(0);
    expect(resume.distinct_venues).toBe(0);
    expect(resume.audience_reached).toBe(0);
    expect(resume.distinct_songs_performed).toBe(0);
    expect(resume.first_show_at).toBeNull();
    expect(resume.months_active).toBe(0);
  });

  it("conta shows concluídos, check-ins e locais distintos", async () => {
    await aCompletedBooking({ checked_in: true });
    await aCompletedBooking();

    const resume = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    expect(resume.shows_completed).toBe(2);
    // Check-in é prova de execução, não só de agenda — por isso é um número
    // separado, e menor.
    expect(resume.shows_with_checkin).toBe(1);
    expect(resume.distinct_venues).toBe(1);
    expect(resume.venues[0].name).toBe(establishment.name);
    expect(resume.venues[0].shows_count).toBe(2);
  });

  it("conta público DISTINTO, não soma de presenças", async () => {
    const eventId = new Uuid().id;
    await aCompletedBooking({ event_id: eventId });

    const fiel = new Uuid().id;
    await attendeeRepo.insert(
      EventAttendee.create({ event_id: eventId, audience_id: fiel }),
    );
    await attendeeRepo.insert(
      EventAttendee.create({
        event_id: eventId,
        audience_id: new Uuid().id,
      }),
    );

    const resume = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    expect(resume.audience_reached).toBe(2);
  });

  it("traz a média de avaliações do ledger", async () => {
    await reviewRepo.insert(
      Review.create({
        target_type: "musician",
        target_id: musician.musician_id.id,
        author_type: "establishment",
        author_id: new Uuid().id,
        rating: 5,
        context_type: "booking",
        context_id: new Uuid().id,
      }),
    );
    await reviewRepo.insert(
      Review.create({
        target_type: "musician",
        target_id: musician.musician_id.id,
        author_type: "establishment",
        author_id: new Uuid().id,
        rating: 4,
        context_type: "booking",
        context_id: new Uuid().id,
      }),
    );

    const resume = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    expect(resume.rating_average).toBe(4.5);
    expect(resume.rating_total).toBe(2);
  });

  it("conta músicas distintas executadas", async () => {
    const performance = Performance.create({
      event_id: new Uuid().id,
      establishment_id: establishment.establishment_id.id,
      musician_id: musician.musician_id.id,
    });
    performance.startSong({ title: "A", artist: "X" });
    performance.startSong({ title: "B", artist: "X" });
    performance.startSong({ title: "A", artist: "X" }); // bis
    performance.endPerformance();
    await performanceRepo.insert(performance);

    const resume = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    expect(resume.distinct_songs_performed).toBe(2);
  });

  it("🔴 nunca expõe valor de cachê", async () => {
    await aCompletedBooking();

    const resume = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    // O currículo é lido pelo público. Expor "média de R$ X por show"
    // destruiria a posição de negociação do músico com o próximo contratante.
    // O campo não existe na origem, para que nenhum presenter futuro possa
    // deixá-lo escapar.
    const asJson = JSON.stringify(resume);
    expect(asJson).not.toMatch(/"fee"/);
    expect(asJson).not.toMatch(/cache|cachê|price|amount/i);
    expect(Object.keys(resume)).not.toContain("average_fee");
  });

  it("um único show conta como 1 mês de estrada, não zero", async () => {
    await aCompletedBooking();

    const resume = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    // Zero leria como "inativo" num perfil de quem acabou de começar.
    expect(resume.months_active).toBe(1);
  });
});
