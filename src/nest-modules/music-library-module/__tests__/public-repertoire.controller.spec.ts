import { MusicLibraryOutput } from "../../../core/music-library/application/use-cases/common/music-library-output";
import {
  PublicMusicLibraryCollectionPresenter,
  PublicMusicLibraryItemPresenter,
} from "../public-music-library.presenter";
import { PublicRepertoireController } from "../public-repertoire.controller";

const MUSICIAN = "11111111-1111-4111-8111-111111111111";
const OTHER_MUSICIAN = "22222222-2222-4222-8222-222222222222";

/** Item com TODOS os campos sensíveis preenchidos — é o que o teste protege. */
function itemWithSecrets(): MusicLibraryOutput {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    musician_id: MUSICIAN,
    title: "Garota de Ipanema",
    artist: "Tom Jobim",
    genre: "bossa-nova",
    key: "F",
    bpm: 128,
    difficulty: 3,
    duration_seconds: 210,
    lyrics: "Olha que coisa mais linda...",
    chords: { timeline: [{ start: 0, symbol: "Fmaj7" }] },
    structure_segments: [{ label: "verso", start: 0, end: 30 }],
    chord_sheet: { lines: ["conteúdo da cifra"] },
    renderable_chord_sheet: { html: "<b>cifra</b>" },
    notes: "Anotação privada: capotraste na 2ª",
    is_favorite: true,
    source: "ai-cifra",
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as MusicLibraryOutput;
}

function page(items: MusicLibraryOutput[]) {
  return {
    items,
    total: items.length,
    current_page: 1,
    per_page: 15,
    last_page: 1,
  };
}

describe("PublicRepertoireController (Bloco 9.6c)", () => {
  let controller: PublicRepertoireController;
  let execute: jest.Mock;

  beforeEach(() => {
    controller = new PublicRepertoireController();
    execute = jest.fn().mockResolvedValue(page([itemWithSecrets()]));
    (controller as any).listUseCase = { execute };
  });

  describe("o que NUNCA pode sair", () => {
    // A razão de existir deste controller. Cifra e letra têm risco de
    // licenciamento; `notes` é anotação privada do músico.
    it.each([
      "lyrics",
      "chords",
      "chord_sheet",
      "renderable_chord_sheet",
      "structure_segments",
      "notes",
    ])("não expõe %s", async (field) => {
      const result = await controller.list(MUSICIAN, {});
      const serialized = JSON.parse(JSON.stringify(result));

      expect(serialized.data[0]).not.toHaveProperty(field);
      // Também não pode vazar como valor dentro de outro campo.
      expect(JSON.stringify(serialized)).not.toContain("Anotação privada");
      expect(JSON.stringify(serialized)).not.toContain("Olha que coisa");
    });

    // Allowlist explícita: se alguém adicionar campo ao output no futuro,
    // este teste falha em vez de deixar vazar em silêncio.
    it("expõe exatamente o conjunto acordado", async () => {
      const result = await controller.list(MUSICIAN, {});
      const item = JSON.parse(JSON.stringify(result)).data[0];

      expect(Object.keys(item).sort()).toEqual(
        [
          "artist",
          "difficulty",
          "duration_seconds",
          "genre",
          "id",
          "musician_id",
          "title",
        ].sort(),
      );
    });
  });

  describe("escopo", () => {
    // O dono do repertório vem do PATH. Aceitar pela query permitiria pedir
    // "de todos" ou de outro músico.
    it("força o musician_id do path no filtro", async () => {
      await controller.list(MUSICIAN, {});

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ musician_id: MUSICIAN }),
        }),
      );
    });

    it("ignora musician_id vindo da query", async () => {
      await controller.list(MUSICIAN, {
        musician_id: OTHER_MUSICIAN,
      } as never);

      const arg = execute.mock.calls[0][0];
      expect(arg.filter.musician_id).toBe(MUSICIAN);
    });

    it("repassa os filtros de metadado", async () => {
      await controller.list(MUSICIAN, {
        title: "Ipanema",
        artist: "Jobim",
        genre: "bossa-nova",
      });

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            title: "Ipanema",
            artist: "Jobim",
            genre: "bossa-nova",
          }),
        }),
      );
    });
  });

  it("devolve o collection presenter público", async () => {
    const result = await controller.list(MUSICIAN, {});

    expect(result).toBeInstanceOf(PublicMusicLibraryCollectionPresenter);
    expect(result.data[0]).toBeInstanceOf(PublicMusicLibraryItemPresenter);
  });
});
