import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

import { MusicLibraryPrismaRepository } from "../../src/core/music-library/infra/db/prisma/music-library-prisma.repository";

/**
 * Catálogo agregado do fã, contra o Postgres de verdade.
 *
 * 🔴 Esta suíte existe porque `searchSongCatalog` é SQL CRU — `groupBy` do
 * Prisma Client não aceita expressão (`lower(btrim(title))`) como chave. O
 * repositório in-memory espelha a regra e não prova NADA sobre a consulta que
 * roda no banco: um nome de coluna errado (`musicianId` é camelCase de
 * verdade, `music_library` vem do `@@map`), um `COUNT` voltando BigInt sem
 * conversão, ou o `CASE` de escopo comparando tipos diferentes passariam
 * limpos no unitário e quebrariam a busca em produção.
 *
 * É a mesma lição de `boosted-request-ordering.e2e-spec.ts` e dos dois bugs de
 * SQL cru achados em `event-prisma.repository.ts` — testes com Prisma mockado
 * não pegam erro de tipo nem de coluna.
 *
 * As três perguntas que só o banco responde:
 *
 * 1. **A deduplicação junta a mesma música de músicos diferentes**, inclusive
 *    com grafia divergente ("garota de ipanema " vs "Garota de Ipanema").
 * 2. **`library_id` é sempre do músico ALVO** — nunca a linha de um terceiro.
 *    É o campo que vira `library_id` do pedido, e o backend recusa id alheio.
 * 3. **O escopo `repertoire` recorta a biblioteca do próprio músico** e ignora
 *    o filtro de cifra: o repertório dele é o que ele toca.
 */
describe("Catálogo de músicas do fã (e2e, Postgres real)", () => {
  jest.setTimeout(30_000);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const repository = new MusicLibraryPrismaRepository(prisma);

  const musicianIds: string[] = [];
  const libraryIds: string[] = [];

  /** O músico a quem o pedido seria feito. */
  let targetId: string;
  /** Outro músico da plataforma — as linhas dele entram no catálogo sem dono. */
  let otherId: string;

  async function seedMusician(label: string): Promise<string> {
    const id = randomUUID();
    await prisma.musician.create({
      data: {
        id,
        email: `e2e-catalog-${label}-${id.slice(0, 8)}@soundmeet.test`,
        name: `E2E ${label}`,
      },
    });
    musicianIds.push(id);
    return id;
  }

  async function seedSong(input: {
    musicianId: string;
    title: string;
    artist: string;
    genre?: string | null;
    /** Sem cifra a música NÃO entra no catálogo da plataforma. */
    withChords?: boolean;
  }): Promise<string> {
    const id = randomUUID();
    await prisma.musicLibrary.create({
      data: {
        id,
        musicianId: input.musicianId,
        title: input.title,
        artist: input.artist,
        genre: input.genre ?? null,
        difficulty: 3,
        ...(input.withChords === false
          ? {}
          : { chords: { timeline: [{ symbol: "C", start_ms: 0 }] } }),
      },
    });
    libraryIds.push(id);
    return id;
  }

  let targetIpanemaId: string;

  beforeAll(async () => {
    targetId = await seedMusician("alvo");
    otherId = await seedMusician("outro");

    // Mesma música, dois músicos, GRAFIAS diferentes — tem de virar UMA entrada.
    targetIpanemaId = await seedSong({
      musicianId: targetId,
      title: "Garota de Ipanema",
      artist: "Tom Jobim",
      genre: "Bossa Nova",
    });
    await seedSong({
      musicianId: otherId,
      title: "garota de ipanema ",
      artist: "tom jobim",
      genre: "MPB",
    });

    // Só do outro músico: entra no catálogo da plataforma, sem `library_id`.
    await seedSong({
      musicianId: otherId,
      title: "Construção",
      artist: "Chico Buarque",
    });

    // Sem cifra: NÃO é "música que a plataforma cifrou", fica fora do escopo
    // `platform` — mas é repertório do músico alvo e aparece no `repertoire`.
    await seedSong({
      musicianId: targetId,
      title: "Ensaio Sem Cifra",
      artist: "Artista Local",
      withChords: false,
    });
  });

  afterAll(async () => {
    if (libraryIds.length) {
      await prisma.musicLibrary.deleteMany({ where: { id: { in: libraryIds } } });
    }
    if (musicianIds.length) {
      await prisma.musician.deleteMany({ where: { id: { in: musicianIds } } });
    }
    await prisma.$disconnect();
  });

  async function search(term: string | null, scope: "platform" | "repertoire") {
    return repository.searchSongCatalog({
      term,
      limit: 50,
      musician_id: targetId,
      scope,
    });
  }

  it("junta a mesma música de músicos diferentes numa entrada só", async () => {
    const items = await search("ipanema", "platform");
    const ipanema = items.filter((i) => /ipanema/i.test(i.title));

    expect(ipanema).toHaveLength(1);
    // 🔴 `COUNT` do Postgres volta BigInt no driver. Sem `Number()` no
    // repositório, o `JSON.stringify` da resposta HTTP lançaria — e o valor
    // aqui não seria estritamente igual a 2.
    expect(ipanema[0]!.musicians_count).toBe(2);
    expect(typeof ipanema[0]!.musicians_count).toBe("number");
  });

  it("devolve o library_id do músico ALVO, nunca o de um terceiro", async () => {
    const items = await search("ipanema", "platform");

    expect(items[0]!.library_id).toBe(targetIpanemaId);
    expect(libraryIds).toContain(items[0]!.library_id);
  });

  /*
   * A música existe na plataforma e este artista não a tem. `library_id` nulo
   * é a resposta certa — o pedido segue por título e artista. Devolver a linha
   * do outro músico faria o backend recusar com 422 na hora de pedir.
   */
  it("devolve library_id nulo quando o alvo não tem a música", async () => {
    const items = await search("constru", "platform");

    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("Construção");
    expect(items[0]!.library_id).toBeNull();
  });

  it("casa por ARTISTA, não só por título", async () => {
    const items = await search("chico", "platform");

    expect(items.map((i) => i.title)).toEqual(["Construção"]);
  });

  it("busca vazia devolve o catálogo, ordenado com as do alvo primeiro", async () => {
    const items = await search(null, "platform");
    const titles = items.map((i) => i.title);

    expect(titles).toContain("Garota de Ipanema");
    expect(titles).toContain("Construção");
    // A que o alvo já tem vem antes da que ele não tem.
    expect(titles.indexOf("Garota de Ipanema")).toBeLessThan(titles.indexOf("Construção"));
  });

  it("música sem cifra fica FORA do catálogo da plataforma", async () => {
    const items = await search("ensaio", "platform");

    expect(items).toHaveLength(0);
  });

  /*
   * 🔴 No escopo restrito o recorte é o músico, e o filtro de cifra NÃO se
   * aplica: o repertório dele é o que ele toca, tenha a plataforma analisado a
   * música ou não. Aplicar o filtro aqui esconderia do fã metade do que o
   * artista sabe tocar — sem erro nenhum.
   */
  it("escopo repertoire traz só o músico alvo, inclusive música sem cifra", async () => {
    const items = await search(null, "repertoire");
    const titles = items.map((i) => i.title);

    expect(titles).toContain("Ensaio Sem Cifra");
    expect(titles).toContain("Garota de Ipanema");
    expect(titles).not.toContain("Construção");
    expect(items.every((i) => i.library_id !== null)).toBe(true);
  });
});
