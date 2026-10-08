import { Establishment } from "../../../../../establishment/domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../../establishment/infra/db/in-memory/establishment-in-memory.repository";
import { EventAttendee } from "../../../../../events/domain/event-attendee.aggregate";
import { EventAttendeeInMemoryRepository } from "../../../../../events/infra/db/in-memory/event-attendee-in-memory.repository";
import { Musician } from "../../../../../musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { Tip } from "../../../../../payment/domain/tip.aggregate";
import { PaymentMethod } from "../../../../../payment/domain/tip-enums";
import { TipInMemoryRepository } from "../../../../../payment/infra/db/in-memory/tip-in-memory.repository";
import { PlanLimitExceededError } from "../../../../../plans/domain/errors/plan-limit-exceeded.error";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { MusicianPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { Request } from "../../../../../request/domain/request.aggregate";
import { RequestInMemoryRepository } from "../../../../../request/infra/db/in-memory/request-in-memory.repository";
import { Uuid } from "../../../../../shared/domain";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Performance } from "../../../../domain/performance.aggregate";
import { PerformanceInMemoryRepository } from "../../../../infra/db/in-memory/performance-in-memory.repository";
import { GetMusicianNightsUseCase } from "../get-musician-nights.use-case";

const DAY = 86_400_000;
const NOW = new Date("2026-09-30T15:00:00.000Z");
const daysAgo = (n: number, hourOffsetMs = 0) =>
  new Date(NOW.getTime() - n * DAY + hourOffsetMs);

describe("GetMusicianNightsUseCase", () => {
  let musicianRepo: MusicianInMemoryRepository;
  let subRepo: SubscriptionInMemoryRepository;
  let performanceRepo: PerformanceInMemoryRepository;
  let requestRepo: RequestInMemoryRepository;
  let tipRepo: TipInMemoryRepository;
  let attendeeRepo: EventAttendeeInMemoryRepository;
  let establishmentRepo: EstablishmentInMemoryRepository;
  let useCase: GetMusicianNightsUseCase;
  let musician: Musician;
  let venue: Establishment;

  beforeEach(async () => {
    musicianRepo = new MusicianInMemoryRepository();
    subRepo = new SubscriptionInMemoryRepository();
    performanceRepo = new PerformanceInMemoryRepository();
    requestRepo = new RequestInMemoryRepository();
    tipRepo = new TipInMemoryRepository();
    attendeeRepo = new EventAttendeeInMemoryRepository();
    establishmentRepo = new EstablishmentInMemoryRepository();

    musician = Musician.fake().aMusician().build();
    await musicianRepo.insert(musician);
    await subRepo.insert(
      new Subscription({
        musician_id: musician.musician_id.id,
        plan_tier: MusicianPlanTier.ESSENTIAL,
        persona: "musician",
        status: SubscriptionStatus.ACTIVE,
      }),
    );

    venue = Establishment.fake().anEstablishment().withName("Bar do Zé").build();
    await establishmentRepo.insert(venue);

    useCase = new GetMusicianNightsUseCase(
      musicianRepo,
      new PlanCheckService(subRepo),
      performanceRepo,
      requestRepo,
      tipRepo,
      attendeeRepo,
      establishmentRepo,
    );
  });

  const me = () => musician.musician_id.id;

  async function aSet(params: {
    eventId: string;
    startedAt: Date;
    songs?: number;
    bandId?: string;
    establishmentId?: string;
  }) {
    const set = Performance.create({
      event_id: params.eventId,
      establishment_id: params.establishmentId ?? venue.establishment_id.id,
      musician_id: me(),
      band_id: params.bandId ?? null,
      started_at: params.startedAt,
    });
    for (let i = 0; i < (params.songs ?? 1); i++) {
      set.startSong({
        title: `Música ${i}`,
        artist: "Artista",
        started_at: new Date(params.startedAt.getTime() + i * 240_000),
      });
    }
    set.endPerformance(
      new Date(params.startedAt.getTime() + (params.songs ?? 1) * 240_000),
    );
    await performanceRepo.insert(set);
    return set;
  }

  async function aTip(params: {
    eventId: string;
    amount: number;
    to?: { musician_id?: string; band_id?: string };
    completed?: boolean;
  }) {
    const tip = Tip.create({
      audience_id: new Uuid().id,
      musician_id: params.to ? (params.to.musician_id ?? null) : me(),
      band_id: params.to?.band_id ?? null,
      event_id: params.eventId,
      amount: params.amount,
      payment_method: PaymentMethod.PIX,
    });
    if (params.completed !== false) tip.complete(new Uuid().id);
    await tipRepo.insert(tip);
  }

  async function aRequest(eventId: string, outcome: "played" | "rejected" | "pending") {
    const request = Request.create({
      event_id: eventId,
      audience_id: new Uuid().id,
      musician_id: me(),
      song_title: "Pedida",
    });
    if (outcome === "played") {
      request.accept();
      request.markAsPlayed();
    }
    if (outcome === "rejected") request.reject("fora do repertório");
    await requestRepo.insert(request);
  }

  async function checkIn(eventId: string, audienceId = new Uuid().id) {
    await attendeeRepo.insert(
      EventAttendee.create({ event_id: eventId, audience_id: audienceId }),
    );
    return audienceId;
  }

  it("FREE recebe o gate do plano, não os números", async () => {
    const free = new GetMusicianNightsUseCase(
      musicianRepo,
      new PlanCheckService(new SubscriptionInMemoryRepository()),
      performanceRepo,
      requestRepo,
      tipRepo,
      attendeeRepo,
      establishmentRepo,
    );
    await expect(
      free.execute({ musician_id: me(), days: 30, now: NOW }),
    ).rejects.toThrow(PlanLimitExceededError);
  });

  it("músico inexistente é 404, não 402", async () => {
    await expect(
      useCase.execute({ musician_id: new Uuid().id, days: 30, now: NOW }),
    ).rejects.toThrow(NotFoundError);
  });

  it("uma noite por EVENTO: set reaberto não dobra pedidos, gorjetas nem público", async () => {
    const eventId = new Uuid().id;
    await aSet({ eventId, startedAt: daysAgo(3), songs: 4 });
    await aSet({ eventId, startedAt: daysAgo(3, 3_600_000), songs: 2 });
    await aRequest(eventId, "played");
    await aRequest(eventId, "rejected");
    await aTip({ eventId, amount: 20 });
    await checkIn(eventId);

    const out = await useCase.execute({ musician_id: me(), days: 30, now: NOW });

    expect(out.current.nights).toHaveLength(1);
    const [night] = out.current.nights;
    expect(night.sets_count).toBe(2);
    expect(night.songs_played).toBe(6);
    expect(night.requests_received).toBe(2);
    expect(night.requests_played).toBe(1);
    expect(night.requests_rejected).toBe(1);
    expect(night.tips_total).toBe(20);
    expect(night.attendees).toBe(1);
    expect(night.establishment_name).toBe("Bar do Zé");
    expect(night.started_at).toEqual(daysAgo(3));
  });

  it("separa o período atual do anterior, encostados, e ignora o que é mais velho", async () => {
    const recent = new Uuid().id;
    const older = new Uuid().id;
    const previousWindow = new Uuid().id;
    const outside = new Uuid().id;

    await aSet({ eventId: recent, startedAt: daysAgo(1) });
    await aSet({ eventId: older, startedAt: daysAgo(6) });
    await aSet({ eventId: previousWindow, startedAt: daysAgo(10) });
    await aSet({ eventId: outside, startedAt: daysAgo(20) });

    const out = await useCase.execute({ musician_id: me(), days: 7, now: NOW });

    // Da mais antiga para a mais recente — a ordem do espectro.
    expect(out.current.nights.map((n) => n.event_id)).toEqual([older, recent]);
    expect(out.current.summary.nights).toBe(2);
    expect(out.previous.summary.nights).toBe(1);
    expect(out.previous.to).toEqual(out.current.from);
    expect(out.current.from).toEqual(daysAgo(7));
    expect(out.previous.from).toEqual(daysAgo(14));
  });

  it("gorjeta: só confirmada, só para mim ou para a banda do set", async () => {
    const eventId = new Uuid().id;
    const bandId = new Uuid().id;
    await aSet({ eventId, startedAt: daysAgo(2), bandId });

    await aTip({ eventId, amount: 10 });
    await aTip({ eventId, amount: 15, to: { band_id: bandId } });
    await aTip({ eventId, amount: 99, to: { musician_id: new Uuid().id } });
    await aTip({ eventId, amount: 50, completed: false });

    const out = await useCase.execute({ musician_id: me(), days: 30, now: NOW });

    expect(out.current.nights[0].tips_count).toBe(2);
    expect(out.current.nights[0].tips_total).toBe(25);
  });

  it("soma dinheiro em centavos: 0,10 + 0,20 fecha em 0,30", async () => {
    const eventId = new Uuid().id;
    await aSet({ eventId, startedAt: daysAgo(2) });
    await aTip({ eventId, amount: 0.1 });
    await aTip({ eventId, amount: 0.2 });

    const out = await useCase.execute({ musician_id: me(), days: 30, now: NOW });

    expect(out.current.nights[0].tips_total).toBe(0.3);
    expect(out.current.summary.tips_total).toBe(0.3);
  });

  it("presença é soma por noite; alcance é gente DISTINTA", async () => {
    const first = new Uuid().id;
    const second = new Uuid().id;
    await aSet({ eventId: first, startedAt: daysAgo(4) });
    await aSet({ eventId: second, startedAt: daysAgo(2) });

    const loyal = await checkIn(first);
    await checkIn(second, loyal);
    await checkIn(second);

    const out = await useCase.execute({ musician_id: me(), days: 30, now: NOW });

    expect(out.current.summary.attendance).toBe(3);
    expect(out.current.summary.audience_reached).toBe(2);
  });

  it("casa removida: nome null, nunca inventado", async () => {
    await aSet({
      eventId: new Uuid().id,
      startedAt: daysAgo(2),
      establishmentId: new Uuid().id,
    });

    const out = await useCase.execute({ musician_id: me(), days: 30, now: NOW });

    expect(out.current.nights[0].establishment_name).toBeNull();
  });

  it("sem show no período: noites vazias e resumo zerado, sem erro", async () => {
    const out = await useCase.execute({ musician_id: me(), days: 90, now: NOW });

    expect(out.current.nights).toEqual([]);
    expect(out.current.summary).toEqual({
      nights: 0,
      songs_played: 0,
      requests_received: 0,
      requests_played: 0,
      tips_count: 0,
      tips_total: 0,
      attendance: 0,
      audience_reached: 0,
    });
  });
});
