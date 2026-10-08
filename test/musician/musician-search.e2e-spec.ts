import { EventEmitterModule } from "@nestjs/event-emitter";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { ConfigModuleRoot } from "../../src/nest-modules/config-module/config-module.module";
import { PrismaService } from "../../src/nest-modules/database-module/prisma/prisma.service";
import { MusiciansModule } from "../../src/nest-modules/musicians-module/musicians.module";
import {
  applyAuthGuardMocksAs,
  musicianAuthUser,
} from "../../src/nest-modules/shared-module/testing/auth-guard-mock";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";
import { IdentityClaimsTestingModule } from "../../src/nest-modules/shared-module/testing/identity-claims-testing.module";

/**
 * Busca pública de músicos — a fronteira HTTP inteira, contra Postgres REAL.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE SÓ ESTE TESTE COBRE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Os specs unitários montam `MusicianSearchParams` com objeto já tipado e o
 * repositório em memória. Nenhum deles vê o que a query string realmente
 * entrega: TEXTO, com lista só quando vem `[]`. Foi assim que cinco defeitos
 * conviveram com a suíte verde até out/2026, todos confirmados por HTTP:
 *
 *  - `filter[price_min]=999999` devolvia a lista inteira (número como texto
 *    era descartado);
 *  - `filter[name]=Bia` não achava "Bia Viola" (a grade busca pelo nome que
 *    exibe, e o filtro olhava o de cadastro);
 *  - `filter[genres]=MPB` respondia 500 (texto no `hasSome` do Prisma);
 *  - `filter[email]=musico5` devolvia o dono daquele e-mail, em rota anônima;
 *  - a lista saía com rua, número, CEP e coordenada exata de cada artista.
 *
 * Os valores aqui viajam como o cliente os manda — URL crua, sem objeto.
 */

/** Marca os músicos deste teste; toda consulta filtra por ela. */
const TAG = "E2E-BUSCA-7F3A";

const IDS = {
  carlao: "7f3a0001-0000-4000-8000-000000000001",
  bia: "7f3a0001-0000-4000-8000-000000000002",
  inactive: "7f3a0001-0000-4000-8000-000000000003",
  radarOff: "7f3a0001-0000-4000-8000-000000000004",
  caller: "7f3a0001-0000-4000-8000-0000000000ff",
};

describe("Busca pública de músicos (e2e)", () => {
  jest.setTimeout(60_000);

  const appHelper = startApp(
    {
      imports: [
        ConfigModuleRoot.forRoot(),
        EventEmitterModule.forRoot(),
        IdentityClaimsTestingModule,
        MusiciansModule,
      ],
    },
    // A busca é pública; quem chama é irrelevante. O duplê só existe para o
    // módulo subir sem Keycloak.
    applyAuthGuardMocksAs(musicianAuthUser(IDS.caller)),
  );

  const prismaOf = () => appHelper.app.get(PrismaService);

  const purge = async () => {
    await prismaOf().musician.deleteMany({
      where: { id: { in: Object.values(IDS) } },
    });
  };

  beforeEach(async () => {
    const prisma = prismaOf();
    await purge();

    const base = {
      genres: [TAG],
      instruments: ["Piano"],
      open_to_gigs: true,
      is_active: true,
    };

    await prisma.musician.create({
      data: {
        ...base,
        id: IDS.carlao,
        email: `e2e+${IDS.carlao}@soundmeet.local`,
        name: "Carlos Teclas E2E",
        stage_name: "Carlão do Piano E2E",
        profile: {
          create: {
            location: {
              city: "São Paulo",
              state: "SP",
              street: "Alameda E2E Santos",
              number: "1742-K",
              neighborhood: "Cerqueira E2E",
              zip_code: "01310200",
              latitude: -23.56284,
              longitude: -46.65432,
            },
            location_lat: -23.56284,
            location_lng: -46.65432,
            price_hour_min: 100,
            price_hour_max: 200,
            price_currency: "BRL",
          },
        },
      },
    });

    await prisma.musician.create({
      data: {
        ...base,
        id: IDS.bia,
        email: `e2e+${IDS.bia}@soundmeet.local`,
        name: "Beatriz Cordas E2E",
        stage_name: "Bia Viola E2E",
        profile: {
          create: {
            location: { city: "Curitiba", state: "PR" },
            price_hour_min: 500,
            price_hour_max: 800,
            price_currency: "BRL",
          },
        },
      },
    });

    await prisma.musician.create({
      data: {
        ...base,
        id: IDS.inactive,
        email: `e2e+${IDS.inactive}@soundmeet.local`,
        name: "Desativado E2E",
        stage_name: "Desativado E2E",
        is_active: false,
      },
    });

    await prisma.musician.create({
      data: {
        ...base,
        id: IDS.radarOff,
        email: `e2e+${IDS.radarOff}@soundmeet.local`,
        name: "Radar Desligado E2E",
        stage_name: "Radar Desligado E2E",
        open_to_gigs: null,
      },
    });
  });

  afterAll(async () => {
    // O app do último teste já fechou; uma conexão própria só para limpar.
    // Apaga SÓ os ids deste teste — o banco é o de desenvolvimento.
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    });
    try {
      await prisma.musician.deleteMany({
        where: { id: { in: Object.values(IDS) } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  /** URL crua, com colchetes — exatamente o que o cliente manda. */
  const search = (query: string) =>
    request(appHelper.app.getHttpServer()).get(
      `/api/v1/musicians?per_page=50&filter[genres][]=${TAG}${query ? `&${query}` : ""}`,
    );

  const stageNames = (body: any): string[] =>
    (body.data as { stage_name: string }[])
      .map((item) => item.stage_name)
      .sort();

  it("lista só quem está ativo E com o radar ligado", async () => {
    const response = await search("").expect(200);

    expect(stageNames(response.body)).toEqual([
      "Bia Viola E2E",
      "Carlão do Piano E2E",
    ]);
  });

  describe("busca pelo nome exibido", () => {
    it("`q` acha pelo nome artístico", async () => {
      const response = await search(
        `filter[q]=${encodeURIComponent("carlão do piano")}`,
      ).expect(200);

      expect(stageNames(response.body)).toEqual(["Carlão do Piano E2E"]);
    });

    it("`q` também acha pelo nome de cadastro", async () => {
      const response = await search("filter[q]=Beatriz").expect(200);

      expect(stageNames(response.body)).toEqual(["Bia Viola E2E"]);
    });

    it("`name` sozinho continua olhando só o cadastro (era o que escondia o artista)", async () => {
      const response = await search("filter[name]=Bia").expect(200);

      expect(stageNames(response.body)).toEqual([]);
    });
  });

  describe("faixa de preço, com o número viajando como texto", () => {
    it("price_min corta quem cobra menos", async () => {
      const response = await search("filter[price_min]=400").expect(200);

      expect(stageNames(response.body)).toEqual(["Bia Viola E2E"]);
    });

    it("price_max corta quem cobra mais", async () => {
      const response = await search("filter[price_max]=250").expect(200);

      expect(stageNames(response.body)).toEqual(["Carlão do Piano E2E"]);
    });

    it("faixa que ninguém atende devolve zero, não a lista inteira", async () => {
      const response = await search("filter[price_min]=999999").expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });
  });

  describe("formato do filtro", () => {
    it("gênero sem colchete é aceito (respondia 500)", async () => {
      const response = await request(appHelper.app.getHttpServer())
        .get(`/api/v1/musicians?per_page=50&filter[genres]=${TAG}`)
        .expect(200);

      expect(stageNames(response.body)).toEqual([
        "Bia Viola E2E",
        "Carlão do Piano E2E",
      ]);
    });

    it.each([
      ["filter[email]=e2e", "email"],
      ["filter[is_active]=false", "is_active"],
      ["filter[open_to_gigs]=false", "open_to_gigs"],
      [`filter[ids][]=${IDS.inactive}`, "ids"],
      ["filter[foo]=1", "foo"],
    ])("%s responde 422, não é ignorado", async (query, key) => {
      const response = await search(query).expect(422);

      expect(response.body.message.join(" ")).toContain(
        `property ${key} should not exist`,
      );
    });

    it("preço que não é número responde 422", async () => {
      await search("filter[price_min]=abc").expect(422);
    });
  });

  it("não devolve endereço nem coordenada: só cidade e estado", async () => {
    const response = await search("filter[q]=Carlos").expect(200);
    const [item] = response.body.data;
    const raw = JSON.stringify(response.body);

    expect(item.profile.location).toEqual({ city: "São Paulo", state: "SP" });
    for (const leaked of [
      "Alameda E2E",
      "1742-K",
      "Cerqueira E2E",
      "01310200",
      "23.56",
      "46.65",
      "latitude",
    ]) {
      expect(raw).not.toContain(leaked);
    }
    for (const absent of ["email", "phone", "plan_tier", "qr_code"]) {
      expect(item).not.toHaveProperty(absent);
    }
  });

  describe("distância", () => {
    it("com origem, o item traz km inteiros; sem origem, null", async () => {
      // ~3 km ao norte da casa do Carlão.
      const near = await search(
        "filter[q]=Carlos&filter[lat]=-23.5338&filter[lng]=-46.6543",
      ).expect(200);
      const noOrigin = await search("filter[q]=Carlos").expect(200);

      expect(near.body.data[0].distance_km).toBe(3);
      expect(noOrigin.body.data[0].distance_km).toBeNull();
    });

    it("origem sem raio NÃO filtra: quem não tem coordenada continua na lista", async () => {
      const response = await search(
        "filter[lat]=-23.5338&filter[lng]=-46.6543",
      ).expect(200);

      expect(stageNames(response.body)).toEqual([
        "Bia Viola E2E",
        "Carlão do Piano E2E",
      ]);
      const bia = response.body.data.find(
        (item: any) => item.stage_name === "Bia Viola E2E",
      );
      expect(bia.distance_km).toBeNull();
    });
  });

  /*
   * 🔴 O vazamento que a busca por raio tinha, verificado por HTTP em
   * 08/out/2026 sem token: a 100 m da casa de um músico, `radius_km=0.09` não
   * o devolvia e `0.11` devolvia. Movendo a origem e repetindo, acha-se a
   * porta. Aqui a casa do Carlão fica em (-23.56284, -46.65432), e a pergunta
   * é feita de pontos a metros dela.
   */
  describe("o raio não localiza a casa do músico", () => {
    const totalAt = async (lat: number, lng: number, radiusKm: number) => {
      const response = await search(
        `filter[q]=Carlos&filter[lat]=${lat}&filter[lng]=${lng}&filter[radius_km]=${radiusKm}`,
      ).expect(200);
      return response.body.meta.total as number;
    };

    it("100 m ao norte da casa: 0,09 km e 0,11 km dão a MESMA resposta", async () => {
      const lat = -23.56194; // ~100 m ao norte de -23.56284
      const lng = -46.65432;

      expect(await totalAt(lat, lng, 0.09)).toBe(await totalAt(lat, lng, 0.11));
    });

    it("em cima da casa, com raio de 50 m, ela NÃO aparece (o centro da célula está a ~500 m)", async () => {
      expect(await totalAt(-23.56284, -46.65432, 0.05)).toBe(0);
    });

    it("em cima do CENTRO da célula, o mesmo raio de 50 m a traz", async () => {
      expect(await totalAt(-23.56, -46.65, 0.05)).toBe(1);
    });

    it("um raio normal continua achando quem mora por perto", async () => {
      expect(await totalAt(-23.5338, -46.6543, 5)).toBe(1);
      expect(await totalAt(-23.5338, -46.6543, 1)).toBe(0);
    });
  });

  describe("GET /musicians/identities", () => {
    const identities = (ids: string) =>
      request(appHelper.app.getHttpServer()).get(
        `/api/v1/musicians/identities?ids=${ids}`,
      );

    it("resolve vários ids numa chamada, na ordem pedida, só com a identidade", async () => {
      const response = await identities(`${IDS.bia},${IDS.carlao}`).expect(200);

      expect(response.body.data).toEqual([
        {
          id: IDS.bia,
          display_name: "Bia Viola E2E",
          avatar: null,
          instruments: ["Piano"],
          genres: [TAG],
          rating: 0,
          total_ratings: 0,
          is_verified: false,
        },
        {
          id: IDS.carlao,
          display_name: "Carlão do Piano E2E",
          avatar: null,
          instruments: ["Piano"],
          genres: [TAG],
          rating: 0,
          total_ratings: 0,
          is_verified: false,
        },
      ]);
      expect(JSON.stringify(response.body)).not.toContain("soundmeet.local");
    });

    it("resolve quem está fora da descoberta (radar desligado, desativado)", async () => {
      const response = await identities(
        `${IDS.radarOff},${IDS.inactive}`,
      ).expect(200);

      expect(response.body.data.map((item: any) => item.display_name)).toEqual([
        "Radar Desligado E2E",
        "Desativado E2E",
      ]);
    });

    it("id inexistente não volta e não derruba os outros", async () => {
      const response = await identities(`${IDS.caller},${IDS.bia}`).expect(200);

      expect(response.body.data.map((item: any) => item.id)).toEqual([IDS.bia]);
    });

    it("não casa como `:id`: `identities` é rota própria", async () => {
      // Declarada depois de `:id`, cairia no ParseUUIDPipe e daria 422.
      await identities(IDS.bia).expect(200);
    });

    it.each(["", "nao-e-uuid", `${IDS.bia},x`])(
      "ids=%p responde 422",
      async (ids) => {
        await identities(ids).expect(422);
      },
    );
  });

  /*
   * Todos empatam em `rating = 0`. Sem desempate único o Postgres pode devolver
   * o mesmo músico em duas páginas e pular outro.
   */
  it("paginação por nota não repete nem pula ninguém", async () => {
    const page = (number: number) =>
      request(appHelper.app.getHttpServer())
        .get(
          `/api/v1/musicians?per_page=1&page=${number}&sort=rating&sort_dir=desc&filter[genres][]=${TAG}`,
        )
        .expect(200);

    const [first, second] = await Promise.all([page(1), page(2)]);
    const ids = [...first.body.data, ...second.body.data].map(
      (item: any) => item.id,
    );

    expect(first.body.meta.total).toBe(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.sort()).toEqual([IDS.carlao, IDS.bia].sort());
    // Desempate por id, determinístico.
    expect(first.body.data[0].id).toBe(IDS.carlao);
  });
});
