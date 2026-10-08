import { Establishment } from "../../../core/establishment/domain/establishment.aggregate";
import { EstablishmentProfile } from "../../../core/establishment/domain/establishment-profile.aggregate";
import { EstablishmentInMemoryRepository } from "../../../core/establishment/infra/db/in-memory/establishment-in-memory.repository";
import { Event, EventId, EventMusician } from "../../../core/events/domain";
import { EventCancelledEvent } from "../../../core/events/domain/events/event-cancelled.event";
import { EventCreatedEvent } from "../../../core/events/domain/events/event-created.event";
import { EventPerformerConfirmedEvent } from "../../../core/events/domain/events/event-performer-confirmed.event";
import {
  EventInMemoryRepository,
  EventMusicianInMemoryRepository,
} from "../../../core/events/infra/db/in-memory";
import { NotifyFollowersInput } from "../../../core/follow/application/use-cases/notify-followers/notify-followers.use-case";
import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { PerformanceStartedEvent } from "../../../core/performance/domain/events/performance-started.event";
import { Address } from "../../../core/shared/domain/value-objects/address.vo";
import { Uuid } from "../../../core/shared/domain/value-objects/uuid.vo";
import {
  FollowNotificationsHandler,
  formatShowTime,
} from "../follow-notifications.handler";
import { FollowRemindersJob } from "../follow-reminders.job";

describe("FollowNotificationsHandler", () => {
  let eventRepo: EventInMemoryRepository;
  let eventMusicianRepo: EventMusicianInMemoryRepository;
  let musicianRepo: MusicianInMemoryRepository;
  let establishmentRepo: EstablishmentInMemoryRepository;
  let calls: NotifyFollowersInput[];
  let handler: FollowNotificationsHandler;

  const HOUR = 60 * 60 * 1000;

  const setup = async (
    opts: { is_public?: boolean; startsIn?: number; start?: Date } = {},
  ) => {
    const venue = Establishment.fake()
      .anEstablishment()
      .withName("Bar do Zé")
      .build();
    await establishmentRepo.insert(venue);
    const musician = Musician.fake()
      .aMusician()
      .withStageName("Ana Lua")
      .withOpenToGigs(true)
      .build();
    await musicianRepo.insert(musician);
    const start =
      opts.start ?? new Date(Date.now() + (opts.startsIn ?? 48) * HOUR);
    const event = new Event({
      event_id: new EventId(),
      establishment_id: venue.establishment_id,
      name: "Roda de Samba",
      start_at: start,
      end_at: new Date(start.getTime() + 3 * HOUR),
      is_public: opts.is_public ?? true,
    });
    await eventRepo.insert(event);
    return { venue, musician, event };
  };

  const created = (event: Event) =>
    new EventCreatedEvent({
      event_id: event.event_id,
      establishment_id: event.establishment_id.id,
      name: event.name,
      description: null,
      start_at: event.start_at,
      end_at: event.end_at,
      status: event.status,
      max_capacity: null,
      current_capacity: 0,
      is_public: event.is_public,
      cover_charge: null,
      created_at: new Date(),
    });

  beforeEach(() => {
    eventRepo = new EventInMemoryRepository();
    eventMusicianRepo = new EventMusicianInMemoryRepository();
    musicianRepo = new MusicianInMemoryRepository();
    establishmentRepo = new EstablishmentInMemoryRepository();
    calls = [];
    handler = new FollowNotificationsHandler(
      {
        execute: async (input: NotifyFollowersInput) => {
          calls.push(input);
          return { claimed: 0, sent: 0 };
        },
      } as any,
      eventRepo,
      eventMusicianRepo,
      musicianRepo,
      establishmentRepo,
    );
  });

  it("show anunciado: avisa seguidores da casa, com nome e horário", async () => {
    const { event, venue } = await setup();

    handler.onEventCreated(created(event));
    await handler.idle();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      kind: "show_announced",
      event_id: event.event_id.id,
      recipients: {
        targets: [
          {
            target_type: "establishment",
            target_id: venue.establishment_id.id,
          },
        ],
      },
      message: {
        title: "Bar do Zé anunciou um show",
        body: `Roda de Samba · ${formatShowTime(event.start_at)}`,
        data: { type: "follow.show_announced", event_id: event.event_id.id },
      },
    });
  });

  it("🔴 evento privado nunca notifica", async () => {
    const { event } = await setup({ is_public: false });

    handler.onEventCreated(created(event));
    await handler.idle();

    expect(calls).toHaveLength(0);
  });

  it("evento que já começou não vira 'anunciado'", async () => {
    const { event } = await setup({ startsIn: -1 });

    handler.onEventCreated(created(event));
    await handler.idle();

    expect(calls).toHaveLength(0);
  });

  it("artista confirmado: avisa seguidores do músico", async () => {
    const { event, musician } = await setup();

    handler.onPerformerConfirmed(
      new EventPerformerConfirmedEvent({
        event_musician_id: new Uuid(),
        event_id: event.event_id.id,
        musician_id: musician.musician_id.id,
        band_id: null,
      }),
    );
    await handler.idle();

    expect(calls[0]).toMatchObject({
      kind: "artist_confirmed",
      recipients: {
        targets: [
          { target_type: "musician", target_id: musician.musician_id.id },
        ],
      },
      message: { title: "Ana Lua vai tocar no Bar do Zé" },
    });
  });

  it("banda confirmada não notifica (não é seguível na v1)", async () => {
    const { event } = await setup();

    handler.onPerformerConfirmed(
      new EventPerformerConfirmedEvent({
        event_musician_id: new Uuid(),
        event_id: event.event_id.id,
        musician_id: null,
        band_id: new Uuid().id,
      }),
    );
    await handler.idle();

    expect(calls).toHaveLength(0);
  });

  it("começou agora: avisa seguidores do músico E da casa", async () => {
    const { event, musician, venue } = await setup({ startsIn: -0.5 });

    handler.onPerformanceStarted(
      new PerformanceStartedEvent({
        performance_id: new Uuid() as any,
        event_id: event.event_id.id,
        establishment_id: venue.establishment_id.id,
        musician_id: musician.musician_id.id,
        band_id: null,
        started_at: new Date(),
      }),
    );
    await handler.idle();

    expect(calls[0]).toMatchObject({
      kind: "started_now",
      recipients: {
        targets: [
          { target_type: "musician", target_id: musician.musician_id.id },
          {
            target_type: "establishment",
            target_id: venue.establishment_id.id,
          },
        ],
      },
      message: { title: "Ana Lua começou agora" },
    });
  });

  it("🔴 músico que fechou contratações não é anunciado (mesma regra de seguir)", async () => {
    const { event, musician, venue } = await setup({ startsIn: -0.5 });
    musician.setOpenToGigs(false);
    await musicianRepo.update(musician);

    handler.onPerformanceStarted(
      new PerformanceStartedEvent({
        performance_id: new Uuid() as any,
        event_id: event.event_id.id,
        establishment_id: venue.establishment_id.id,
        musician_id: musician.musician_id.id,
        band_id: null,
        started_at: new Date(),
      }),
    );
    await handler.idle();

    expect(calls).toHaveLength(0);
  });

  it("cancelamento avisa quem soube do show, não todo seguidor", async () => {
    const { event } = await setup();

    handler.onEventCancelled(
      new EventCancelledEvent({
        event_id: event.event_id,
        cancelled_at: new Date(),
      }),
    );
    await handler.idle();

    expect(calls[0]).toMatchObject({
      kind: "show_cancelled",
      recipients: {
        previously_notified: [
          "show_announced",
          "artist_confirmed",
          "day_reminder",
        ],
      },
    });
  });

  it("falha no envio vira log, nunca exceção para quem criou o evento", async () => {
    const { event } = await setup();
    handler = new FollowNotificationsHandler(
      {
        execute: async () => {
          throw new Error("expo fora");
        },
      } as any,
      eventRepo,
      eventMusicianRepo,
      musicianRepo,
      establishmentRepo,
    );

    expect(() => handler.onEventCreated(created(event))).not.toThrow();
    await expect(handler.idle()).resolves.toBeUndefined();
  });

  describe("lembrete do dia", () => {
    it("avisa seguidores da casa e dos músicos confirmados (não os pendentes)", async () => {
      // 21h em Brasília; o lembrete roda às 10h do mesmo dia.
      const { event, musician, venue } = await setup({
        start: new Date("2026-10-03T00:00:00.000Z"),
      });
      await eventMusicianRepo.insert(
        EventMusician.create({
          event_id: event.event_id.id,
          musician_id: musician.musician_id.id,
        }),
      );
      const pendingId = new Uuid().id;
      await eventMusicianRepo.insert(
        EventMusician.create({
          event_id: event.event_id.id,
          musician_id: pendingId,
          status: "pending",
        }),
      );

      await handler.remindToday(
        event.event_id.id,
        new Date("2026-10-02T13:00:00.000Z"),
      );

      const targets = (calls[0].recipients as any).targets;
      expect(targets).toEqual(
        expect.arrayContaining([
          {
            target_type: "establishment",
            target_id: venue.establishment_id.id,
          },
          { target_type: "musician", target_id: musician.musician_id.id },
        ]),
      );
      expect(targets).not.toContainEqual({
        target_type: "musician",
        target_id: pendingId,
      });
      expect(calls[0].message.title).toBe("Hoje tem show no Bar do Zé");
    });

    it("o job entrega ao handler os shows públicos das próximas 24h", async () => {
      const now = new Date("2026-10-02T13:00:00.000Z"); // 10h em Brasília
      const venue = Establishment.fake().anEstablishment().build();
      await establishmentRepo.insert(venue);
      const make = async (start: string, is_public = true) => {
        const event = new Event({
          event_id: new EventId(),
          establishment_id: venue.establishment_id,
          name: "Show",
          start_at: new Date(start),
          end_at: new Date(new Date(start).getTime() + 3 * HOUR),
          is_public,
        });
        await eventRepo.insert(event);
        return event.event_id.id;
      };
      const tonight = await make("2026-10-03T00:30:00.000Z");
      const afterMidnight = await make("2026-10-03T03:30:00.000Z");
      await make("2026-10-02T23:00:00.000Z", false); // privado
      await make("2026-10-02T12:00:00.000Z"); // já começou
      await make("2026-10-03T14:00:00.000Z"); // depois de 24h

      const candidates: string[] = [];
      const job = new FollowRemindersJob(
        { get: () => "development" } as any,
        {
          remindToday: async (id: string, at: Date) => {
            expect(at).toBe(now);
            candidates.push(id);
            return true;
          },
        } as any,
        eventRepo,
      );

      await job.run(now);

      expect(candidates.sort()).toEqual([tonight, afterMidnight].sort());
    });

    describe("🔴 'hoje' é o dia da CASA, não o de Brasília", () => {
      const now = new Date("2026-10-02T13:00:00.000Z"); // 10h Brasília, 9h Manaus

      const venueIn = async (state: string, city: string) => {
        const venue = Establishment.fake()
          .anEstablishment()
          .withProfile(
            EstablishmentProfile.fake()
              .aProfile()
              .withLocation(
                new Address({
                  street: "Rua A",
                  number: "1",
                  neighborhood: "Centro",
                  city,
                  state,
                  zipCode: "69000000",
                }),
              )
              .build(),
          )
          .build();
        await establishmentRepo.insert(venue);
        return venue;
      };

      const showAt = async (venue: Establishment, start: string) => {
        const event = new Event({
          event_id: new EventId(),
          establishment_id: venue.establishment_id,
          name: "Show",
          start_at: new Date(start),
          end_at: new Date(new Date(start).getTime() + 3 * HOUR),
          is_public: true,
        });
        await eventRepo.insert(event);
        return event;
      };

      it("23h30 em Manaus (0h30 em Brasília) ainda é hoje — e o horário sai no fuso de Manaus", async () => {
        const venue = await venueIn("AM", "Manaus");
        const event = await showAt(venue, "2026-10-03T03:30:00.000Z");

        await expect(handler.remindToday(event.event_id.id, now)).resolves.toBe(
          true,
        );
        expect(calls[0].message.body).toContain("23:30");
      });

      it("0h30 em São Paulo é amanhã: não lembra hoje", async () => {
        const venue = await venueIn("SP", "São Paulo");
        const event = await showAt(venue, "2026-10-03T03:30:00.000Z");

        await expect(handler.remindToday(event.event_id.id, now)).resolves.toBe(
          false,
        );
        expect(calls).toHaveLength(0);
      });
    });
  });
});
