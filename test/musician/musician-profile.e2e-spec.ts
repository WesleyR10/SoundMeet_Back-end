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
 * Escrita e leitura do perfil do músico — contra Postgres REAL.
 *
 * O repositório em memória devolve a MESMA instância do agregado que o
 * use-case acabou de alterar, então qualquer campo que só exista em memória
 * parece persistido. Foi o que escondeu o defeito de "anos de experiência":
 * o teste unitário lia `output.profile.experience` da instância viva e
 * passava, enquanto o banco nunca recebia o valor. Aqui cada leitura volta do
 * Postgres por HTTP.
 */

const OWNER_ID = "7f3a0002-0000-4000-8000-000000000001";
const OTHER_ID = "7f3a0002-0000-4000-8000-000000000002";

const moduleMetadata = {
  imports: [
    ConfigModuleRoot.forRoot(),
    EventEmitterModule.forRoot(),
    IdentityClaimsTestingModule,
    MusiciansModule,
  ],
};

async function seedMusicians(prisma: PrismaService): Promise<void> {
  await prisma.musician.deleteMany({
    where: { id: { in: [OWNER_ID, OTHER_ID] } },
  });

  await prisma.musician.create({
    data: {
      id: OWNER_ID,
      email: `e2e+${OWNER_ID}@soundmeet.local`,
      name: "Dono E2E",
      stage_name: "Dono do Perfil E2E",
      phone: "+5511970000001",
      experience_years: 3,
      genres: ["MPB"],
      instruments: ["Violão"],
      profile: {
        create: {
          location: {
            city: "Recife",
            state: "PE",
            street: "Rua da Aurora E2E",
            number: "88-Z",
            zip_code: "50050000",
            latitude: -8.05912,
            longitude: -34.88134,
          },
          location_lat: -8.05912,
          location_lng: -34.88134,
        },
      },
    },
  });

  await prisma.musician.create({
    data: {
      id: OTHER_ID,
      email: `e2e+${OTHER_ID}@soundmeet.local`,
      name: "Outro E2E",
      phone: "+5511970000002",
    },
  });
}

/** Apaga SÓ os dois ids deste teste — o banco é o de desenvolvimento. */
async function purgeMusicians(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    await prisma.musician.deleteMany({
      where: { id: { in: [OWNER_ID, OTHER_ID] } },
    });
  } finally {
    await prisma.$disconnect();
  }
}

describe("Perfil do músico — o DONO (e2e)", () => {
  jest.setTimeout(60_000);

  const appHelper = startApp(
    moduleMetadata,
    applyAuthGuardMocksAs(musicianAuthUser(OWNER_ID)),
  );

  const http = () => request(appHelper.app.getHttpServer());

  beforeEach(async () => {
    await seedMusicians(appHelper.app.get(PrismaService));
  });

  afterAll(purgeMusicians);

  /*
   * 🔴 O defeito que só o Postgres mostrava. A experiência é coluna de
   * `musicians`; o app a mandava a `PATCH .../profile`, que alterava uma cópia
   * em memória, respondia 200 com o valor novo e não gravava nada. A leitura
   * abaixo volta do banco por HTTP — o agregado é remontado das colunas.
   */
  it("anos de experiência por PATCH /musicians/:id ficam no banco", async () => {
    await http()
      .patch(`/api/v1/musicians/${OWNER_ID}`)
      .send({ experience_years: 12 })
      .expect(200);

    const reread = await http()
      .get(`/api/v1/musicians/${OWNER_ID}`)
      .expect(200);

    expect(reread.body.data.experience_years).toBe(12);
    expect(reread.body.data.is_experienced).toBe(true);

    const row = await appHelper.app
      .get(PrismaService)
      .musician.findUniqueOrThrow({ where: { id: OWNER_ID } });
    expect(row.experience_years).toBe(12);
  });

  it("gêneros e instrumentos por PATCH /musicians/:id ficam no banco, numa chamada", async () => {
    await http()
      .patch(`/api/v1/musicians/${OWNER_ID}`)
      .send({ genres: ["Samba", "Choro"], instruments: ["Cavaquinho"] })
      .expect(200);

    const reread = await http()
      .get(`/api/v1/musicians/${OWNER_ID}`)
      .expect(200);

    expect(reread.body.data.genres).toEqual(["Samba", "Choro"]);
    expect(reread.body.data.instruments).toEqual(["Cavaquinho"]);
  });

  /*
   * Um campo, uma porta. `/profile` aceitava os três calado — dois regravavam
   * o que a outra rota já gravava e `experience` não gravava nada. Agora a
   * tentativa é 422, que é como o app descobre que errou de rota.
   */
  it.each([
    ["experience", 12],
    ["instruments", ["Bateria"]],
    ["genres", ["Rock"]],
  ])("PATCH .../profile recusa %s com 422", async (field, value) => {
    const response = await http()
      .patch(`/api/v1/musicians/${OWNER_ID}/profile`)
      .send({ [field]: value })
      .expect(422);

    expect(response.body.message.join(" ")).toContain(
      `property ${field} should not exist`,
    );
  });

  it("o perfil não repete gêneros, instrumentos nem experiência", async () => {
    const response = await http()
      .get(`/api/v1/musicians/${OWNER_ID}`)
      .expect(200);

    for (const field of ["experience", "instruments", "genres"]) {
      expect(response.body.data.profile).not.toHaveProperty(field);
    }
    expect(response.body.data.experience_years).toBe(3);
    expect(response.body.data.genres).toEqual(["MPB"]);
  });

  it("o dono lê o próprio endereço completo, e-mail e plano", async () => {
    const response = await http()
      .get(`/api/v1/musicians/${OWNER_ID}`)
      .expect(200);
    const musician = response.body.data;

    expect(musician.email).toBe(`e2e+${OWNER_ID}@soundmeet.local`);
    expect(musician.plan_tier).toBe("free");
    expect(musician.profile.location).toMatchObject({
      street: "Rua da Aurora E2E",
      number: "88-Z",
      zip_code: "50050000",
      latitude: -8.05912,
      longitude: -34.88134,
    });
  });

  describe("campos que não entram por PATCH /musicians/:id", () => {
    it.each([
      ["avatar", "https://evil.example/pixel.png"],
      ["is_active", false],
      ["open_to_gigs", true],
      ["priceRanges", [{ model: "per_hour", min: 1, max: 2 }]],
    ])("%s responde 422 e não altera nada", async (field, value) => {
      const response = await http()
        .patch(`/api/v1/musicians/${OWNER_ID}`)
        .send({ [field]: value })
        .expect(422);

      expect(response.body.message.join(" ")).toContain(
        `property ${field} should not exist`,
      );

      const row = await appHelper.app
        .get(PrismaService)
        .musician.findUniqueOrThrow({ where: { id: OWNER_ID } });
      expect(row.avatar).toBeNull();
      expect(row.is_active).toBe(true);
      expect(row.open_to_gigs).toBeNull();
    });
  });

  it("bio acima do limite responde 422", async () => {
    await http()
      .patch(`/api/v1/musicians/${OWNER_ID}`)
      .send({ bio: "b".repeat(1001) })
      .expect(422);
  });

  it("telefone de outro músico responde 422 dizendo o campo, não 409 genérico", async () => {
    const response = await http()
      .patch(`/api/v1/musicians/${OWNER_ID}`)
      .send({ phone: "+5511970000002" })
      .expect(422);

    expect(response.body.message.join(" ")).toContain("Phone already in use");
  });

  it("token de push: registrar e apagar respondem 204 e mexem só no token", async () => {
    const prisma = appHelper.app.get(PrismaService);

    const registered = await http()
      .patch(`/api/v1/musicians/${OWNER_ID}/push-token`)
      .send({
        push_token: "ExpoPushToken[e2e]",
        push_token_platform: "android",
      })
      .expect(204);
    expect(registered.text).toBe("");
    expect(
      (await prisma.musician.findUniqueOrThrow({ where: { id: OWNER_ID } }))
        .push_token,
    ).toBe("ExpoPushToken[e2e]");

    await http().delete(`/api/v1/musicians/${OWNER_ID}/push-token`).expect(204);
    const row = await prisma.musician.findUniqueOrThrow({
      where: { id: OWNER_ID },
    });
    expect(row.push_token).toBeNull();
    expect(row.push_token_platform).toBeNull();
    expect(row.stage_name).toBe("Dono do Perfil E2E");

    // Idempotente: sair duas vezes não é erro.
    await http().delete(`/api/v1/musicians/${OWNER_ID}/push-token`).expect(204);
  });

  describe("rotas removidas de propósito", () => {
    it("POST /musicians não existe", async () => {
      await http()
        .post("/api/v1/musicians")
        .send({ name: "Fantasma", email: "fantasma@soundmeet.local" })
        .expect(404);
    });

    it("DELETE /musicians/:id não existe, e o músico continua lá", async () => {
      await http().delete(`/api/v1/musicians/${OWNER_ID}`).expect(404);

      await expect(
        appHelper.app
          .get(PrismaService)
          .musician.findUnique({ where: { id: OWNER_ID } }),
      ).resolves.not.toBeNull();
    });
  });
});

describe("Perfil do músico — um TERCEIRO (e2e)", () => {
  jest.setTimeout(60_000);

  const appHelper = startApp(
    moduleMetadata,
    applyAuthGuardMocksAs(musicianAuthUser(OTHER_ID)),
  );

  beforeEach(async () => {
    await seedMusicians(appHelper.app.get(PrismaService));
  });

  afterAll(purgeMusicians);

  it("recebe o perfil sem endereço, contato nem plano", async () => {
    const response = await request(appHelper.app.getHttpServer())
      .get(`/api/v1/musicians/${OWNER_ID}`)
      .expect(200);
    const musician = response.body.data;
    const raw = JSON.stringify(response.body);

    expect(musician.stage_name).toBe("Dono do Perfil E2E");
    expect(musician.profile.location).toEqual({ city: "Recife", state: "PE" });
    for (const absent of ["email", "phone", "cnpj", "plan_tier"]) {
      expect(musician).not.toHaveProperty(absent);
    }
    for (const leaked of [
      "Rua da Aurora E2E",
      "88-Z",
      "50050000",
      "8.05",
      "34.88",
      "latitude",
      "+5511970000001",
    ]) {
      expect(raw).not.toContain(leaked);
    }
  });

  it("não consegue escrever no perfil alheio", async () => {
    await request(appHelper.app.getHttpServer())
      .patch(`/api/v1/musicians/${OWNER_ID}`)
      .send({ bio: "invadido" })
      .expect(403);
  });
});
