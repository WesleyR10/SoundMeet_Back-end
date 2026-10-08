import {
  purgeBandE2E,
  seedBand,
  seedMusician,
  startBandE2EApp,
  withStandalonePrisma,
} from "./band-e2e.helpers";

/**
 * Dissolver banda — `DELETE /bands/:id` contra Postgres REAL.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE SÓ ESTE TESTE COBRE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O desfecho depende de FKs e de uma CHECK que o repositório em memória não
 * tem. `bookings.bandId` e `inquiries.bandId` são `ON DELETE SET NULL` sob a
 * CHECK "músico OU banda, exatamente um": apagar uma banda com qualquer
 * proposta faz o `SET NULL` violar a CHECK e o Postgres recusa o DELETE. Onde
 * não há CHECK (`event_musicians`), o `SET NULL` passa e deixa o line-up do
 * show apontando para ninguém.
 *
 * O `BandCommitmentsPrismaReader` é quem lê essas tabelas — e ele só é
 * exercitado aqui.
 */

const MUSICIANS = {
  leader: "d15501e1-0000-4000-8000-000000000001",
  invited: "d15501e1-0000-4000-8000-000000000002",
};
const BAND = "d15501e2-0000-4000-8000-000000000001";
const ESTABLISHMENT = "d15501e3-0000-4000-8000-000000000001";
const EVENT = "d15501e4-0000-4000-8000-000000000001";

const IDS = {
  bands: [BAND],
  musicians: Object.values(MUSICIANS),
  establishments: [ESTABLISHMENT],
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("Dissolver banda (e2e)", () => {
  jest.setTimeout(60_000);

  const api = startBandE2EApp();

  beforeEach(async () => {
    const prisma = api.prisma();
    await purgeBandE2E(prisma, IDS);

    await seedMusician(prisma, MUSICIANS.leader, "Líder E2E");
    await seedMusician(prisma, MUSICIANS.invited, "Convidada E2E");
    await prisma.establishment.create({
      data: {
        id: ESTABLISHMENT,
        email: `e2e+${ESTABLISHMENT}@soundmeet.local`,
        name: "Casa E2E",
        establishment_type: "bar",
      },
    });
    await seedBand(prisma, {
      id: BAND,
      name: "Banda a Dissolver E2E",
      open_to_gigs: true,
      members: [
        { musician_id: MUSICIANS.leader, role: "leader" },
        { musician_id: MUSICIANS.invited, status: "pending" },
      ],
    });

    api.asMusician(MUSICIANS.leader);
  });

  afterAll(async () => {
    await withStandalonePrisma((prisma) => purgeBandE2E(prisma, IDS));
  });

  const bandRow = () => api.prisma().band.findUnique({ where: { id: BAND } });

  const seedBooking = (
    status: "pending" | "confirmed" | "completed" | "cancelled",
    startsInMs: number,
  ) =>
    api.prisma().booking.create({
      data: {
        establishmentId: ESTABLISHMENT,
        bandId: BAND,
        status,
        start_at: new Date(Date.now() + startsInMs),
        end_at: new Date(Date.now() + startsInMs + 3 * HOUR),
      },
    });

  it("banda sem registro em lugar nenhum é apagada", async () => {
    const response = await api.delete(`/bands/${BAND}`).expect(200);

    expect(response.body.data).toEqual({ outcome: "deleted" });
    expect(await bandRow()).toBeNull();
  });

  it("o banco RECUSA apagar a linha de uma banda com proposta — é o fato em que o arquivamento se apoia", async () => {
    await seedBooking("completed", -30 * DAY);

    // `ON DELETE SET NULL` em `bookings.bandId` + CHECK "músico OU banda":
    // o SET NULL deixaria o booking sem nenhum dos dois, e o Postgres aborta.
    await expect(
      api.prisma().band.delete({ where: { id: BAND } }),
    ).rejects.toThrow();
    expect(await bandRow()).not.toBeNull();
  });

  describe("🔴 com histórico: arquiva em vez de apagar", () => {
    it("show já realizado — o DELETE de linha violaria a CHECK de `bookings`", async () => {
      const booking = await seedBooking("completed", -30 * DAY);

      const response = await api.delete(`/bands/${BAND}`).expect(200);

      expect(response.body.data).toEqual({ outcome: "archived" });
      const row = await bandRow();
      expect(row).toMatchObject({ is_active: false, open_to_gigs: false });
      // O show continua sendo desta banda.
      const kept = await api
        .prisma()
        .booking.findUnique({ where: { id: booking.id } });
      expect(kept!.bandId).toBe(BAND);
    });

    it("só line-up, sem booking — o DELETE passaria e deixaria o show sem artista", async () => {
      await api.prisma().event.create({
        data: {
          id: EVENT,
          establishmentId: ESTABLISHMENT,
          name: "Noite E2E",
          startTime: new Date(Date.now() - 10 * DAY),
          endTime: new Date(Date.now() - 10 * DAY + 3 * HOUR),
        },
      });
      const lineup = await api.prisma().eventMusician.create({
        data: { eventId: EVENT, bandId: BAND },
      });

      const response = await api.delete(`/bands/${BAND}`).expect(200);

      expect(response.body.data).toEqual({ outcome: "archived" });
      const kept = await api
        .prisma()
        .eventMusician.findUnique({ where: { id: lineup.id } });
      expect(kept!.bandId).toBe(BAND);
    });

    it("a banda arquivada some da busca, descarta os convites e continua tendo nome", async () => {
      await seedBooking("cancelled", -5 * DAY);

      await api.delete(`/bands/${BAND}`).expect(200);

      api.asAnonymous();
      const search = await api
        .get(
          `/bands?per_page=50&filter[name]=${encodeURIComponent("Banda a Dissolver E2E")}`,
        )
        .expect(200);
      expect(search.body.data).toEqual([]);

      const members = await api
        .prisma()
        .bandMember.findMany({ where: { bandId: BAND } });
      expect(members.map((m) => m.musicianId)).toEqual([MUSICIANS.leader]);

      const detail = await api.get(`/bands/${BAND}`).expect(200);
      expect(detail.body.data).toMatchObject({
        name: "Banda a Dissolver E2E",
        is_active: false,
      });
      const identities = await api
        .get(`/bands/identities?ids=${BAND}`)
        .expect(200);
      expect(identities.body.data[0].display_name).toBe(
        "Banda a Dissolver E2E",
      );
    });

    it("banda arquivada não é mais alterada nem volta ao radar", async () => {
      await seedBooking("completed", -30 * DAY);
      await api.delete(`/bands/${BAND}`).expect(200);

      await api.patch(`/bands/${BAND}`, { name: "Voltou E2E" }).expect(422);
      await api
        .patch(`/bands/${BAND}/open-to-gigs`, { open_to_gigs: true })
        .expect(422);
      // Repetir o pedido não é erro.
      const again = await api.delete(`/bands/${BAND}`).expect(200);
      expect(again.body.data).toEqual({ outcome: "archived" });
    });
  });

  describe("🔴 com compromisso em aberto: recusa", () => {
    it.each(["pending", "confirmed"] as const)(
      "show %s no futuro → 409, e a banda fica como estava",
      async (status) => {
        await seedBooking(status, 7 * DAY);

        const response = await api.delete(`/bands/${BAND}`).expect(409);

        expect(response.body.message.join(" ")).toContain(
          "1 show marcado ou proposto",
        );
        expect(await bandRow()).toMatchObject({
          is_active: true,
          open_to_gigs: true,
        });
      },
    );

    it("conversa de contratação aberta → 409", async () => {
      await api.prisma().inquiry.create({
        data: { establishmentId: ESTABLISHMENT, bandId: BAND, status: "open" },
      });

      const response = await api.delete(`/bands/${BAND}`).expect(409);

      expect(response.body.message.join(" ")).toContain(
        "1 conversa de contratação em andamento",
      );
    });

    it("proposta que já expirou não segura a banda: é histórico", async () => {
      await seedBooking("expired" as never, 7 * DAY);

      const response = await api.delete(`/bands/${BAND}`).expect(200);

      expect(response.body.data).toEqual({ outcome: "archived" });
    });
  });

  it("quem não é o líder não dissolve", async () => {
    api.asMusician(MUSICIANS.invited);

    await api.delete(`/bands/${BAND}`).expect(403);

    expect(await bandRow()).not.toBeNull();
  });
});
