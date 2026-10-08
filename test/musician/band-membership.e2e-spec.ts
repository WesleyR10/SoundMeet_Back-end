import {
  purgeBandE2E,
  seedBand,
  seedMusician,
  startBandE2EApp,
  withStandalonePrisma,
} from "./band-e2e.helpers";

/**
 * Convite, saída e liderança de banda — contra Postgres REAL.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE SÓ ESTE TESTE COBRE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Todo spec unitário e de integração deste fluxo usa o repositório em memória,
 * que devolve a MESMA instância que o teste criou. Três defeitos viveram ali
 * dentro, com a suíte verde, até out/2026:
 *
 *  - **Aceitar, recusar e remover respondiam 422 em produção.** O mapper do
 *    Prisma monta os integrantes com `Uuid`; os use-cases chegam com
 *    `MusicianId`; e `ValueObject.equals` exige a mesma classe. Em memória os
 *    dois lados eram `MusicianId`. Só existe depois de uma ida ao banco.
 *  - **O convite pendente nunca aparecia para o convidado** — a tela consultava
 *    a busca pública, que só devolve vínculo aceito.
 *  - **`formed_in` não era gravado** — o controller o descartava.
 *
 * Cada requisição aqui carrega a banda do Postgres de novo.
 */

const MUSICIANS = {
  leader: "b4e70001-0000-4000-8000-000000000001",
  invited: "b4e70001-0000-4000-8000-000000000002",
  member: "b4e70001-0000-4000-8000-000000000003",
  stranger: "b4e70001-0000-4000-8000-000000000004",
  admin: "b4e70001-0000-4000-8000-0000000000ad",
};

const BAND = "b4e70002-0000-4000-8000-000000000001";

const IDS = { bands: [BAND], musicians: Object.values(MUSICIANS) };

describe("Convite, saída e liderança de banda (e2e)", () => {
  jest.setTimeout(60_000);

  const api = startBandE2EApp();

  beforeEach(async () => {
    const prisma = api.prisma();
    await purgeBandE2E(prisma, IDS);

    await seedMusician(prisma, MUSICIANS.leader, "Líder E2E");
    await seedMusician(prisma, MUSICIANS.invited, "Convidada E2E");
    await seedMusician(prisma, MUSICIANS.member, "Integrante E2E");
    await seedMusician(prisma, MUSICIANS.stranger, "Estranho E2E");

    await seedBand(prisma, {
      id: BAND,
      name: "Banda do Convite E2E",
      address: {
        city: "São Paulo",
        state: "SP",
        street: "Rua do Convite E2E",
        zip_code: "01310200",
      },
      members: [
        { musician_id: MUSICIANS.leader, role: "leader" },
        { musician_id: MUSICIANS.member, instrument: "Baixo" },
        {
          musician_id: MUSICIANS.invited,
          status: "pending",
          instrument: "Voz",
        },
      ],
    });
  });

  afterAll(async () => {
    await withStandalonePrisma((prisma) => purgeBandE2E(prisma, IDS));
  });

  const statusOf = async (musician_id: string) => {
    const row = await api.prisma().bandMember.findUnique({
      where: { bandId_musicianId: { bandId: BAND, musicianId: musician_id } },
    });
    return row?.status ?? null;
  };

  describe("🔴 minhas bandas — o convite chega ao convidado", () => {
    it("a convidada vê o convite pendente, com a própria linha e sem o endereço da banda", async () => {
      api.asMusician(MUSICIANS.invited);

      const response = await api.get("/bands/mine").expect(200);

      expect(response.body.data).toHaveLength(1);
      const [band] = response.body.data;
      expect(band.id).toBe(BAND);
      expect(
        band.members.find((m: any) => m.musician_id === MUSICIANS.invited),
      ).toMatchObject({ status: "pending", instrument: "Voz" });
      expect(band.address).toEqual({ city: "São Paulo", state: "SP" });
      expect(JSON.stringify(band)).not.toContain("Rua do Convite E2E");
    });

    it("quem integra a banda a recebe por dentro, com os convites em aberto", async () => {
      api.asMusician(MUSICIANS.member);

      const response = await api.get("/bands/mine").expect(200);

      const [band] = response.body.data;
      expect(band.address.street).toBe("Rua do Convite E2E");
      expect(band.members).toHaveLength(3);
    });

    it("quem não tem vínculo nenhum recebe lista vazia", async () => {
      api.asMusician(MUSICIANS.stranger);

      const response = await api.get("/bands/mine").expect(200);

      expect(response.body.data).toEqual([]);
    });

    it("`mine` não casa como `:id` — a ordem das rotas no servidor real", async () => {
      api.asMusician(MUSICIANS.invited);

      // Declarada depois de `@Get(":id")`, responderia 422 ("uuid is expected").
      await api.get("/bands/mine").expect(200);
    });
  });

  describe("🔴 aceitar, recusar e sair funcionam com a banda vinda do banco", () => {
    it("aceitar o convite", async () => {
      api.asMusician(MUSICIANS.invited);

      await api.post(`/bands/${BAND}/invites/accept`).expect(200);

      expect(await statusOf(MUSICIANS.invited)).toBe("accepted");
    });

    it("recusar o convite", async () => {
      api.asMusician(MUSICIANS.invited);

      const response = await api
        .post(`/bands/${BAND}/invites/decline`)
        .expect(200);

      expect(await statusOf(MUSICIANS.invited)).toBe("declined");
      // Recusou: recebe a banda como terceiro.
      expect(JSON.stringify(response.body)).not.toContain("Rua do Convite E2E");
    });

    it("quem não foi convidado não aceita nada", async () => {
      api.asMusician(MUSICIANS.stranger);

      await api.post(`/bands/${BAND}/invites/accept`).expect(422);
    });

    it("o integrante sai da banda sozinho", async () => {
      api.asMusician(MUSICIANS.member);

      await api
        .delete(`/bands/${BAND}/members/${MUSICIANS.member}`)
        .expect(204);

      expect(await statusOf(MUSICIANS.member)).toBeNull();
    });

    it("o líder cancela um convite pendente", async () => {
      api.asMusician(MUSICIANS.leader);

      await api
        .delete(`/bands/${BAND}/members/${MUSICIANS.invited}`)
        .expect(204);

      expect(await statusOf(MUSICIANS.invited)).toBeNull();
    });

    it("integrante não remove outro integrante", async () => {
      api.asMusician(MUSICIANS.member);

      await api
        .delete(`/bands/${BAND}/members/${MUSICIANS.invited}`)
        .expect(403);

      expect(await statusOf(MUSICIANS.invited)).toBe("pending");
    });

    it("o líder não é removido enquanto houver outros integrantes", async () => {
      api.asMusician(MUSICIANS.leader);

      await api
        .delete(`/bands/${BAND}/members/${MUSICIANS.leader}`)
        .expect(422);

      expect(await statusOf(MUSICIANS.leader)).toBe("accepted");
    });
  });

  describe("convidar", () => {
    it("líder em plano sem banda recebe 402, não um convite", async () => {
      api.asMusician(MUSICIANS.leader);

      await api
        .post(`/bands/${BAND}/members`, {
          musician_id: MUSICIANS.stranger,
          instrument: "Bateria",
        })
        .expect(402);

      expect(await statusOf(MUSICIANS.stranger)).toBeNull();
    });

    it("líder PRO convida, e o convite nasce pendente", async () => {
      await api.prisma().subscription.create({
        data: {
          musician_id: MUSICIANS.leader,
          plan_tier: "pro",
          persona: "musician",
          status: "active",
        },
      });
      api.asMusician(MUSICIANS.leader);

      await api
        .post(`/bands/${BAND}/members`, {
          musician_id: MUSICIANS.stranger,
          instrument: "Bateria",
        })
        .expect(201);

      expect(await statusOf(MUSICIANS.stranger)).toBe("pending");
    });

    it("🔴 `role` no corpo responde 422 — convite é sempre para integrante", async () => {
      api.asMusician(MUSICIANS.leader);

      await api
        .post(`/bands/${BAND}/members`, {
          musician_id: MUSICIANS.stranger,
          instrument: "Bateria",
          role: "leader",
        })
        .expect(422);
    });

    it("integrante comum não convida", async () => {
      api.asMusician(MUSICIANS.member);

      await api
        .post(`/bands/${BAND}/members`, {
          musician_id: MUSICIANS.stranger,
          instrument: "Bateria",
        })
        .expect(403);
    });
  });

  describe("🔴 atualizar", () => {
    it("`formed_in` é gravado no banco — antes a rota respondia 200 e não gravava", async () => {
      api.asMusician(MUSICIANS.leader);

      const response = await api
        .patch(`/bands/${BAND}`, { formed_in: 2015 })
        .expect(200);

      expect(response.body.data.formed_in).toBe(2015);
      const row = await api.prisma().band.findUnique({ where: { id: BAND } });
      expect(row!.formed_in).toBe(2015);

      await api.patch(`/bands/${BAND}`, { formed_in: null }).expect(200);
      const cleared = await api
        .prisma()
        .band.findUnique({ where: { id: BAND } });
      expect(cleared!.formed_in).toBeNull();
    });

    it("faixa de preço gravada volta a carregar (Decimal do Postgres)", async () => {
      api.asMusician(MUSICIANS.leader);

      await api
        .patch(`/bands/${BAND}`, {
          priceRange: { model: "per_event", min: 800, max: 1500 },
        })
        .expect(200);

      // A leitura seguinte carrega a banda do banco — é onde quebrava.
      const response = await api.get(`/bands/${BAND}`).expect(200);
      expect(response.body.data.priceRange).toMatchObject({
        min: 800,
        max: 1500,
      });
    });

    it.each([
      ["open_to_gigs", true],
      ["is_active", false],
      ["avatar", "https://evil.example/x.png"],
    ])(
      "`%s` no corpo responde 422: tem outra porta, ou nenhuma",
      async (key, value) => {
        api.asMusician(MUSICIANS.leader);

        await api.patch(`/bands/${BAND}`, { [key]: value }).expect(422);
      },
    );

    it("integrante comum não altera a banda", async () => {
      api.asMusician(MUSICIANS.member);

      await api.patch(`/bands/${BAND}`, { name: "Tomada E2E" }).expect(403);
    });
  });

  describe("🔴 transferir a liderança muda quem opera a banda, na hora", () => {
    it("a nova líder passa a alterar; o ex-líder deixa de poder alterar e dissolver", async () => {
      api.asMusician(MUSICIANS.leader);
      await api
        .patch(`/bands/${BAND}/leadership`, {
          new_leader_musician_id: MUSICIANS.member,
        })
        .expect(200);

      // Nenhum token foi renovado: a liderança é lida do banco.
      api.asMusician(MUSICIANS.member);
      await api
        .patch(`/bands/${BAND}`, { name: "Da Nova Líder E2E" })
        .expect(200);
      await api
        .patch(`/bands/${BAND}/open-to-gigs`, { open_to_gigs: true })
        .expect(200);

      api.asMusician(MUSICIANS.leader);
      await api
        .patch(`/bands/${BAND}`, { name: "Do Ex-Líder E2E" })
        .expect(403);
      await api.delete(`/bands/${BAND}`).expect(403);

      const row = await api.prisma().band.findUnique({ where: { id: BAND } });
      expect(row!.name).toBe("Da Nova Líder E2E");
    });

    it("convidada pendente não assume a liderança", async () => {
      api.asMusician(MUSICIANS.leader);

      await api
        .patch(`/bands/${BAND}/leadership`, {
          new_leader_musician_id: MUSICIANS.invited,
        })
        .expect(422);
    });
  });

  describe("🔴 ler a banda: por dentro × de fora", () => {
    it("o líder recebe o endereço completo e os convites", async () => {
      api.asMusician(MUSICIANS.leader);

      const response = await api.get(`/bands/${BAND}`).expect(200);

      expect(response.body.data.address.street).toBe("Rua do Convite E2E");
      expect(response.body.data.members).toHaveLength(3);
    });

    it.each([
      ["anônimo", { kind: "anonymous" } as const],
      [
        "estranho autenticado",
        { kind: "musician", id: MUSICIANS.stranger } as const,
      ],
      [
        "convidada pendente",
        { kind: "musician", id: MUSICIANS.invited } as const,
      ],
    ])("%s recebe a versão pública", async (_label, actor) => {
      api.as(actor);

      const response = await api.get(`/bands/${BAND}`).expect(200);

      expect(response.body.data.address).toEqual({
        city: "São Paulo",
        state: "SP",
      });
      expect(response.body.data.members).toHaveLength(2);
    });

    it("token recusado de um integrante vira 401 — o app renova a sessão e repete", async () => {
      api.as({ kind: "rejected", sub: MUSICIANS.leader });

      await api.get(`/bands/${BAND}`).expect(401);
    });

    it("token recusado de um estranho segue como anônimo", async () => {
      api.as({ kind: "rejected", sub: MUSICIANS.stranger });

      await api.get(`/bands/${BAND}`).expect(200);
    });

    it("admin vê a banda por dentro", async () => {
      api.as({ kind: "admin", id: MUSICIANS.admin });

      const response = await api.get(`/bands/${BAND}`).expect(200);

      expect(response.body.data.address.street).toBe("Rua do Convite E2E");
    });
  });
});
