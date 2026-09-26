import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

import { RequestSearchParams } from "../../src/core/request/domain/request.repository";
import { RequestPrismaRepository } from "../../src/core/request/infra/db/prisma/request-prisma.repository";

/**
 * A ordenação da fila do músico, contra o Postgres de verdade.
 *
 * 🔴 Esta suíte existe porque o `ORDER BY` do ramo `sort === "priority"` é SQL
 * CRU: o repositório in-memory pode espelhar a regra corretamente e ainda
 * assim não provar nada sobre a expressão que roda no banco. Um erro de nome
 * de coluna, um `COALESCE` faltando ou o enum comparado como texto passariam
 * limpos no unitário e quebrariam a fila em produção.
 *
 * O caso mais importante aqui é o `sort_dir=asc`: os dois níveis de destaque
 * precisam ser sempre DESC, senão um query param enterra no fim da fila
 * exatamente os pedidos que foram pagos.
 */
describe("Fila do músico — ordenação por destaque (e2e, Postgres real)", () => {
  jest.setTimeout(30_000);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const repository = new RequestPrismaRepository(prisma);

  const musicianIds: string[] = [];
  const audienceIds: string[] = [];
  const establishmentIds: string[] = [];

  let eventId: string;
  let musicianId: string;
  let audienceId: string;

  async function seedScenario() {
    const unique = randomUUID().replace(/-/g, "").slice(0, 12);

    musicianId = randomUUID();
    await prisma.musician.create({
      data: {
        id: musicianId,
        email: `e2e-boost-m-${unique}@soundmeet.test`,
        name: "E2E Destaque",
      },
    });
    musicianIds.push(musicianId);

    audienceId = randomUUID();
    await prisma.audience.create({
      data: {
        id: audienceId,
        email: `e2e-boost-a-${unique}@soundmeet.test`,
        name: "E2E Fã",
      },
    });
    audienceIds.push(audienceId);

    const establishmentId = randomUUID();
    await prisma.establishment.create({
      data: {
        id: establishmentId,
        email: `e2e-boost-e-${unique}@soundmeet.test`,
        name: "E2E Casa",
        establishment_type: "bar",
      },
    });
    establishmentIds.push(establishmentId);

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
  }

  /**
   * Cria um pedido direto no banco.
   *
   * `created_at` é controlado de propósito: a prioridade por IDADE é o
   * critério que o destaque precisa vencer, então os pedidos sem destaque
   * nascem VELHOS (prioridade alta) e os destacados nascem novos. Se o
   * destaque não estivesse acima na ordenação, os antigos ficariam na frente.
   */
  async function seedRequest(opts: {
    songTitle: string;
    ageMinutes: number;
    boost?: { amount: number; status: "promised" | "awaiting_payment" | "paid" | "expired" | "cancelled" };
  }) {
    const createdAt = new Date(Date.now() - opts.ageMinutes * 60 * 1000);
    const needsCharge =
      opts.boost?.status === "awaiting_payment" || opts.boost?.status === "paid";

    let boostTipId: string | null = null;
    if (needsCharge) {
      boostTipId = randomUUID();
      await prisma.tip.create({
        data: {
          id: boostTipId,
          audienceId,
          musicianId,
          eventId,
          amount: opts.boost!.amount,
          paymentMethod: "pix",
          status: opts.boost!.status === "paid" ? "completed" : "pending",
        },
      });
    }

    await prisma.musicRequest.create({
      data: {
        id: randomUUID(),
        eventId,
        audienceId,
        musicianId,
        songTitle: opts.songTitle,
        artistName: "E2E",
        status: "pending",
        created_at: createdAt,
        updated_at: createdAt,
        ...(opts.boost
          ? {
              boostAmount: opts.boost.amount,
              boostStatus: opts.boost.status,
              boostTipId,
              boostPromisedAt: createdAt,
              boostChargedAt: needsCharge ? createdAt : null,
              boostPaidAt: opts.boost.status === "paid" ? createdAt : null,
            }
          : {}),
      },
    });
  }

  const titlesInOrder = async (sort_dir: "asc" | "desc") => {
    const result = await repository.search(
      RequestSearchParams.create({
        filter: { event_id: eventId, musician_id: musicianId },
        sort: "priority",
        sort_dir,
        per_page: 20,
      }),
    );
    return result.items.map((item) => item.song_title.value);
  };

  beforeAll(async () => {
    await seedScenario();

    // Sem destaque, mas VELHOS: prioridade alta pela regra de idade.
    await seedRequest({ songTitle: "sem-destaque-antigo", ageMinutes: 120 });
    await seedRequest({ songTitle: "sem-destaque-medio", ageMinutes: 45 });
    // Destaques vencidos/cancelados: pedido comum, não podem subir.
    await seedRequest({
      songTitle: "destaque-vencido",
      ageMinutes: 90,
      boost: { amount: 50, status: "expired" },
    });
    await seedRequest({
      songTitle: "destaque-cancelado",
      ageMinutes: 90,
      boost: { amount: 99, status: "cancelled" },
    });
    // Destaques válidos, recém-criados: têm de vencer os velhos acima.
    await seedRequest({
      songTitle: "destaque-5",
      ageMinutes: 1,
      boost: { amount: 5, status: "promised" },
    });
    await seedRequest({
      songTitle: "destaque-30",
      ageMinutes: 1,
      boost: { amount: 30, status: "paid" },
    });
    await seedRequest({
      songTitle: "destaque-12",
      ageMinutes: 1,
      boost: { amount: 12, status: "awaiting_payment" },
    });
  });

  afterAll(async () => {
    // Ordem: folhas primeiro. `music_requests` referencia `tips` pela FK do
    // destaque, e `tips` referencia `audiences` com onDelete Restrict.
    if (eventId) {
      await prisma.musicRequest.deleteMany({ where: { eventId } });
      await prisma.tip.deleteMany({ where: { eventId } });
      await prisma.event.deleteMany({ where: { id: eventId } });
    }
    if (establishmentIds.length) {
      await prisma.establishment.deleteMany({
        where: { id: { in: establishmentIds } },
      });
    }
    if (audienceIds.length) {
      await prisma.audience.deleteMany({ where: { id: { in: audienceIds } } });
    }
    if (musicianIds.length) {
      await prisma.musician.deleteMany({ where: { id: { in: musicianIds } } });
    }
    await prisma.$disconnect();
  });

  it("põe os destaques no topo, do maior valor para o menor", async () => {
    const titles = await titlesInOrder("desc");

    expect(titles.slice(0, 3)).toEqual([
      "destaque-30",
      "destaque-12",
      "destaque-5",
    ]);
  });

  it("destaque recém-criado vence pedido antigo sem destaque", async () => {
    const titles = await titlesInOrder("desc");

    expect(titles.indexOf("destaque-5")).toBeLessThan(
      titles.indexOf("sem-destaque-antigo"),
    );
  });

  /*
   * `expired` e `cancelled` não destacam. O valor alto (R$50 e R$99) existe
   * justamente para que um `COALESCE("boostAmount", 0)` sem o filtro de status
   * os jogasse para o topo — e o teste falharia.
   */
  it("destaque vencido ou cancelado não sobe", async () => {
    const titles = await titlesInOrder("desc");
    const firstNonBoosted = titles.indexOf("destaque-vencido");

    expect(firstNonBoosted).toBeGreaterThan(titles.indexOf("destaque-5"));
    expect(titles.indexOf("destaque-cancelado")).toBeGreaterThan(
      titles.indexOf("destaque-5"),
    );
  });

  /*
   * 🔴 O caso que a mudança de ordenação pode quebrar em silêncio: `sort_dir`
   * vale para a prioridade por idade, NUNCA para o destaque. Se os níveis de
   * destaque seguissem `sort_dir`, aqui os pagos apareceriam no fim.
   */
  it("sort_dir=asc não enterra os pedidos pagos", async () => {
    const titles = await titlesInOrder("asc");

    expect(titles.slice(0, 3)).toEqual([
      "destaque-30",
      "destaque-12",
      "destaque-5",
    ]);
  });
});
