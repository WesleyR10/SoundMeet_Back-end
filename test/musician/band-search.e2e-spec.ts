import {
  purgeBandE2E,
  seedBand,
  seedMusician,
  startBandE2EApp,
  withStandalonePrisma,
} from "./band-e2e.helpers";

/**
 * Busca pública de bandas — a fronteira HTTP inteira, contra Postgres REAL.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE SÓ ESTE TESTE COBRE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Os specs unitários montam `BandSearchParams` com objeto já tipado e o
 * repositório em memória. Nenhum deles vê o que a query string realmente
 * entrega: TEXTO, com lista só quando vem `[]`. Seis defeitos conviveram com a
 * suíte verde até out/2026, todos confirmados por HTTP na API local:
 *
 *  - `filter[price_min]=999999` devolvia todas as bandas;
 *  - `filter[genres]=MPB` respondia 500;
 *  - `filter[banana]=1` era aceito calado;
 *  - `filter[musician_id]=…` listava bandas fora do radar;
 *  - a lista saía com rua, número, CEP e coordenada exata de cada banda;
 *  - o raio era medido na coordenada exata (0,09 km excluía, 0,13 incluía).
 *
 * Os valores aqui viajam como o cliente os manda — URL crua, sem objeto.
 */

/** Marca as bandas deste teste; toda consulta filtra por ela. */
const TAG = "E2E-BANDA-BUSCA-9C1D";

const MUSICIANS = {
  leader: "9c1d0001-0000-4000-8000-000000000001",
  pending: "9c1d0001-0000-4000-8000-000000000002",
  declined: "9c1d0001-0000-4000-8000-000000000003",
};

const BANDS = {
  priced: "9c1d0002-0000-4000-8000-000000000001",
  cheap: "9c1d0002-0000-4000-8000-000000000002",
  offRadar: "9c1d0002-0000-4000-8000-000000000003",
  archived: "9c1d0002-0000-4000-8000-000000000004",
};

const IDS = {
  bands: Object.values(BANDS),
  musicians: Object.values(MUSICIANS),
};

/** Endereço da banda `priced` — a "casa" que a busca não pode entregar. */
const HOME = { latitude: -23.56284, longitude: -46.65432 };

describe("Busca pública de bandas (e2e)", () => {
  jest.setTimeout(60_000);

  const api = startBandE2EApp();

  beforeEach(async () => {
    const prisma = api.prisma();
    await purgeBandE2E(prisma, IDS);

    await seedMusician(prisma, MUSICIANS.leader, "Líder E2E");
    await seedMusician(prisma, MUSICIANS.pending, "Pendente E2E");
    await seedMusician(prisma, MUSICIANS.declined, "Recusou E2E");

    await seedBand(prisma, {
      id: BANDS.priced,
      name: "Banda Cara E2E",
      genres: [TAG, "MPB-E2E"],
      open_to_gigs: true,
      price: { min: 800, max: 1500 },
      address: {
        city: "São Paulo",
        state: "SP",
        street: "Alameda E2E Santos",
        number: "1742-K",
        neighborhood: "Cerqueira E2E",
        zip_code: "01310200",
        ...HOME,
      },
      members: [
        { musician_id: MUSICIANS.leader, role: "leader" },
        { musician_id: MUSICIANS.pending, status: "pending" },
        { musician_id: MUSICIANS.declined, status: "declined" },
      ],
    });
    await seedBand(prisma, {
      id: BANDS.cheap,
      name: "Banda Barata E2E",
      genres: [TAG],
      open_to_gigs: true,
      price: { min: 100, max: 200 },
      address: { city: "Curitiba", state: "PR" },
      members: [{ musician_id: MUSICIANS.leader, role: "leader" }],
    });
    await seedBand(prisma, {
      id: BANDS.offRadar,
      name: "Banda Fora do Radar E2E",
      genres: [TAG],
      open_to_gigs: null,
      members: [{ musician_id: MUSICIANS.leader, role: "leader" }],
    });
    await seedBand(prisma, {
      id: BANDS.archived,
      name: "Banda Arquivada E2E",
      genres: [TAG],
      open_to_gigs: true,
      is_active: false,
      members: [{ musician_id: MUSICIANS.leader, role: "leader" }],
    });
  });

  afterAll(async () => {
    await withStandalonePrisma((prisma) => purgeBandE2E(prisma, IDS));
  });

  /** URL crua, com colchetes — exatamente o que o cliente manda. */
  const search = (query = "") =>
    api.get(
      `/bands?per_page=50&filter[genres][]=${TAG}${query ? `&${query}` : ""}`,
    );

  const names = (body: any): string[] =>
    (body.data as { name: string }[]).map((item) => item.name).sort();

  it("lista só quem está no radar E ativa", async () => {
    const response = await search().expect(200);

    expect(names(response.body)).toEqual([
      "Banda Barata E2E",
      "Banda Cara E2E",
    ]);
  });

  describe("🔴 filtro de preço — query string é texto", () => {
    it("`price_min` filtra", async () => {
      const response = await search("filter[price_min]=500").expect(200);

      expect(names(response.body)).toEqual(["Banda Cara E2E"]);
    });

    it("`price_max` filtra", async () => {
      const response = await search("filter[price_max]=300").expect(200);

      expect(names(response.body)).toEqual(["Banda Barata E2E"]);
    });

    it("faixa que ninguém atende devolve lista vazia, não a lista inteira", async () => {
      const response = await search("filter[price_min]=999999").expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  it("🔴 `filter[genres]=X` sem colchete responde 200, não 500", async () => {
    const response = await api
      .get(`/bands?per_page=50&filter[genres]=MPB-E2E`)
      .expect(200);

    expect(names(response.body)).toEqual(["Banda Cara E2E"]);
  });

  describe("🔴 allowlist do filtro", () => {
    it.each([
      ["chave desconhecida", "filter[banana]=1"],
      [
        "`musician_id` (contornava o opt-in do líder)",
        `filter[musician_id]=${MUSICIANS.leader}`,
      ],
      ["`open_to_gigs`", "filter[open_to_gigs]=false"],
      ["`is_active`", "filter[is_active]=false"],
    ])("%s responde 422", async (_label, query) => {
      await search(query).expect(422);
    });
  });

  describe("🔴 privacidade: o que sai para quem não é da banda", () => {
    it("do endereço saem só cidade e estado", async () => {
      const response = await search().expect(200);
      const raw = JSON.stringify(response.body);

      const priced = response.body.data.find(
        (item: any) => item.id === BANDS.priced,
      );
      expect(priced.address).toEqual({ city: "São Paulo", state: "SP" });
      for (const leak of [
        "Alameda E2E Santos",
        "1742-K",
        "Cerqueira E2E",
        "01310200",
        String(HOME.latitude),
        String(HOME.longitude),
      ]) {
        expect(raw).not.toContain(leak);
      }
    });

    it("convite pendente e convite recusado não saem — na lista nem no detalhe", async () => {
      const list = await search().expect(200);
      const detail = await api.get(`/bands/${BANDS.priced}`).expect(200);

      for (const body of [list.body, detail.body]) {
        const raw = JSON.stringify(body);
        expect(raw).not.toContain(MUSICIANS.pending);
        expect(raw).not.toContain(MUSICIANS.declined);
        expect(raw).not.toContain("responded_at");
      }
      expect(detail.body.data.members).toHaveLength(1);
      expect(detail.body.data.address).toEqual({
        city: "São Paulo",
        state: "SP",
      });
    });
  });

  describe("🔴 busca por raio na grade pública", () => {
    const near = (lat: number, lng: number, radiusKm: number) =>
      search(
        `filter[lat]=${lat}&filter[lng]=${lng}&filter[radius_km]=${radiusKm}`,
      );

    it("acha a banda da região", async () => {
      const response = await near(HOME.latitude, HOME.longitude, 5).expect(200);

      expect(names(response.body)).toEqual(["Banda Cara E2E"]);
    });

    it("não deixa triangular o endereço: 100 m de diferença na origem não muda a resposta", async () => {
      // ~100 m ao norte da casa. Com a coordenada exata, raio 0,09 km NÃO
      // trazia a banda e 0,13 km trazia — a fronteira era um círculo em volta
      // da porta. Na grade de ~1 km, os dois raios dão a mesma resposta.
      const north = HOME.latitude + 0.0009;
      const tight = await near(north, HOME.longitude, 0.09).expect(200);
      const loose = await near(north, HOME.longitude, 0.13).expect(200);

      expect(names(tight.body)).toEqual(names(loose.body));
    });

    it("banda sem coordenada fica fora da busca por raio", async () => {
      const response = await near(-25.4284, -49.2733, 50).expect(200);

      expect(names(response.body)).toEqual([]);
    });
  });

  describe("identidades em lote", () => {
    it("resolve várias bandas numa chamada, na ordem pedida, sem endereço nem convites", async () => {
      const response = await api
        .get(`/bands/identities?ids=${BANDS.offRadar},${BANDS.priced}`)
        .expect(200);

      expect(response.body.data.map((item: any) => item.id)).toEqual([
        BANDS.offRadar,
        BANDS.priced,
      ]);
      expect(Object.keys(response.body.data[0]).sort()).toEqual([
        "avatar",
        "display_name",
        "genres",
        "id",
        "instruments",
      ]);
      expect(JSON.stringify(response.body)).not.toContain("Alameda");
    });

    it("🔴 `identities` não casa como `:id` — a ordem das rotas no servidor real", async () => {
      // Declarada depois de `@Get(":id")`, esta rota responderia 422
      // ("uuid is expected") para qualquer chamada.
      await api.get(`/bands/identities?ids=${BANDS.priced}`).expect(200);
    });

    it("id que não é UUID responde 422", async () => {
      await api.get("/bands/identities?ids=abc").expect(422);
    });
  });
});
