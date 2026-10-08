import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

import { EventId } from "../../src/core/events/domain";
import { EventPrismaRepository } from "../../src/core/events/infra/db/prisma/event-prisma.repository";
import { VenueLocationPrismaAdapter } from "../../src/core/events/infra/venue-location";
import { Follow } from "../../src/core/follow/domain/follow.aggregate";
import { FollowPrismaRepository } from "../../src/core/follow/infra/db/prisma/follow-prisma.repository";
import { FollowNotificationLedgerPrisma } from "../../src/core/follow/infra/notifications";

/**
 * Bloco 19 contra o Postgres de verdade.
 *
 * 🔴 Três pedaços aqui são SQL cru ou dependem de constraint do banco, e o
 * in-memory não prova nada sobre eles:
 *  - a listagem de seguidores (`SELECT DISTINCT … ORDER BY … LIMIT`, cursor);
 *  - o ledger (`INSERT … ON CONFLICT DO NOTHING RETURNING`) — a dedupe que
 *    impede o mesmo push duas vezes, inclusive sob concorrência;
 *  - a renovação da presença no check-in repetido (não pode contar duas
 *    vezes na lotação).
 *
 * Pré-requisito: `npx prisma migrate deploy` com as migrations
 * `20261002120000_add_event_attendee_presence` e
 * `20261002130000_follows_and_audience_push`.
 */
describe("Seguir + presença (e2e, Postgres real)", () => {
  jest.setTimeout(30_000);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const follows = new FollowPrismaRepository(prisma);
  const ledger = new FollowNotificationLedgerPrisma(prisma);

  const audienceIds: string[] = [];
  let establishmentId: string;
  let eventId: string;
  const musicianTarget = {
    target_type: "musician" as const,
    target_id: randomUUID(),
  };
  let venueTarget: { target_type: "establishment"; target_id: string };

  async function createAudience(): Promise<string> {
    const id = randomUUID();
    const unique = id.replace(/-/g, "").slice(0, 12);
    await prisma.audience.create({
      data: {
        id,
        email: `e2e-follow-${unique}@soundmeet.test`,
        name: "E2E Fã",
      },
    });
    audienceIds.push(id);
    return id;
  }

  beforeAll(async () => {
    establishmentId = randomUUID();
    const unique = establishmentId.replace(/-/g, "").slice(0, 12);
    await prisma.establishment.create({
      data: {
        id: establishmentId,
        email: `e2e-follow-e-${unique}@soundmeet.test`,
        name: "E2E Casa",
        establishment_type: "bar",
        profile: {
          create: {
            location: { city: "Rio de Janeiro", state: "RJ" },
            location_city: "Rio de Janeiro",
            location_lat: -22.9068,
            location_lng: -43.1729,
          },
        },
      },
    });
    venueTarget = { target_type: "establishment", target_id: establishmentId };

    eventId = randomUUID();
    const now = new Date();
    await prisma.event.create({
      data: {
        id: eventId,
        establishmentId,
        name: "E2E Show",
        startTime: now,
        endTime: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        status: "active",
      },
    });
  });

  afterAll(async () => {
    // Folhas primeiro: deliveries e attendees apontam para eventos/fãs.
    await prisma.notificationDelivery.deleteMany({
      where: { event_id: eventId },
    });
    await prisma.eventAttendee.deleteMany({ where: { eventId } });
    await prisma.follow.deleteMany({
      where: { audience_id: { in: audienceIds } },
    });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.establishment.deleteMany({ where: { id: establishmentId } });
    await prisma.audience.deleteMany({ where: { id: { in: audienceIds } } });
    await prisma.$disconnect();
  });

  describe("listagem de seguidores", () => {
    let both: string;
    let muted: string;
    const venueOnly: string[] = [];

    beforeAll(async () => {
      both = await createAudience();
      await follows.insert(
        Follow.create({ audience_id: both, ...musicianTarget }),
      );
      await follows.insert(
        Follow.create({ audience_id: both, ...venueTarget }),
      );

      muted = await createAudience();
      const mutedFollow = Follow.create({ audience_id: muted, ...venueTarget });
      mutedFollow.disableNotifications();
      await follows.insert(mutedFollow);

      for (let i = 0; i < 4; i++) {
        const id = await createAudience();
        venueOnly.push(id);
        await follows.insert(
          Follow.create({ audience_id: id, ...venueTarget }),
        );
      }
    });

    it("🔴 quem segue músico E casa aparece UMA vez; aviso desligado fica de fora", async () => {
      const ids = await follows.listNotifiableFollowerIds({
        targets: [musicianTarget, venueTarget],
        after: null,
        limit: 100,
      });

      expect(ids.filter((id) => id === both)).toHaveLength(1);
      expect(ids).not.toContain(muted);
      expect(new Set(ids)).toEqual(new Set([both, ...venueOnly]));
    });

    it("o cursor percorre tudo, em ordem, sem repetir", async () => {
      const seen: string[] = [];
      let after: string | null = null;
      for (;;) {
        const page = await follows.listNotifiableFollowerIds({
          targets: [musicianTarget, venueTarget],
          after,
          limit: 2,
        });
        if (!page.length) break;
        seen.push(...page);
        after = page[page.length - 1];
      }

      expect(seen).toEqual([...seen].sort());
      expect(new Set(seen).size).toBe(seen.length);
      expect(seen).toHaveLength(5);
    });

    it("🔴 sem alvo devolve vazio, nunca todos", async () => {
      expect(
        await follows.listNotifiableFollowerIds({
          targets: [],
          after: null,
          limit: 100,
        }),
      ).toEqual([]);
    });

    it("a unique (fã, alvo) barra o follow duplicado", async () => {
      await expect(
        follows.insert(Follow.create({ audience_id: both, ...venueTarget })),
      ).rejects.toThrow();
    });
  });

  describe("ledger de entrega", () => {
    it("🔴 devolve só quem entrou agora — reenvio não passa", async () => {
      const a = await createAudience();
      const b = await createAudience();
      const at = new Date();

      const first = await ledger.claim({
        kind: "show_announced",
        event_id: eventId,
        audience_ids: [a],
        at,
      });
      const second = await ledger.claim({
        kind: "show_announced",
        event_id: eventId,
        audience_ids: [a, b],
        at,
      });

      expect(first).toEqual([a]);
      expect(second).toEqual([b]);
    });

    it("🔴 dois disparos simultâneos: cada fã é reservado por um só", async () => {
      const ids = await Promise.all([
        createAudience(),
        createAudience(),
        createAudience(),
      ]);
      const claim = () =>
        ledger.claim({
          kind: "started_now",
          event_id: eventId,
          audience_ids: ids,
          at: new Date(),
        });

      const [x, y] = await Promise.all([claim(), claim()]);

      expect([...x, ...y].sort()).toEqual([...ids].sort());
    });

    it("lista quem soube do show, para o aviso de cancelamento", async () => {
      const notified = await ledger.findNotifiedAudienceIds({
        event_id: eventId,
        kinds: ["show_announced"],
      });
      expect(notified.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("presença no check-in", () => {
    it("lê a coordenada da casa pelo perfil", async () => {
      const coords = await new VenueLocationPrismaAdapter(
        prisma,
      ).findVenueCoordinates(establishmentId);
      expect(coords).toEqual({ latitude: -22.9068, longitude: -43.1729 });
    });

    it("grava o veredito (nunca a coordenada) e renova sem contar duas vezes", async () => {
      const fan = await createAudience();
      const repo = new EventPrismaRepository(prisma);
      const before = await prisma.event.findUnique({ where: { id: eventId } });

      await repo.addAttendee(new EventId(eventId), fan, new Date(), {
        method: "geo",
        verified_at: new Date("2026-10-02T22:00:00Z"),
        distance_m: 120,
      });
      await repo.addAttendee(new EventId(eventId), fan, new Date(), {
        method: "geo",
        verified_at: new Date("2026-10-02T23:00:00Z"),
        distance_m: 40,
      });

      const row = await prisma.eventAttendee.findUnique({
        where: { eventId_audienceId: { eventId, audienceId: fan } },
      });
      const after = await prisma.event.findUnique({ where: { id: eventId } });

      expect(row).toMatchObject({
        presenceMethod: "geo",
        presenceDistanceM: 40,
        presenceVerifiedAt: new Date("2026-10-02T23:00:00Z"),
      });
      expect(after!.currentCapacity).toBe(before!.currentCapacity + 1);
    });
  });
});
