import { SyncedLyrics } from "@core/synced-lyrics/domain";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import {
  IChordSheetReadModel,
  MusicLibraryChordSheetReadModel,
} from "../../../gateways/chord-sheet-read-model.interface";
import { GetChordSheetForMusicLibraryUseCase } from "../get-chord-sheet-for-music-library.use-case";

class ChordSheetReadModelStub implements IChordSheetReadModel {
  items: Record<string, MusicLibraryChordSheetReadModel> = {} as any;

  async getMusicLibraryById(
    id: string,
  ): Promise<MusicLibraryChordSheetReadModel | null> {
    return this.items[id] ?? null;
  }
}

describe("GetChordSheetForMusicLibraryUseCase Unit Tests", () => {
  let useCase: GetChordSheetForMusicLibraryUseCase;
  let readModel: ChordSheetReadModelStub;

  beforeEach(() => {
    readModel = new ChordSheetReadModelStub();
    useCase = new GetChordSheetForMusicLibraryUseCase(readModel);
  });

  it("should throw an error when input is invalid", async () => {
    await expect(() =>
      useCase.execute({
        musician_id: "",
        music_library_id: "",
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("should throw NotFoundError when music library not found", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(input.music_library_id, SyncedLyrics),
    );
  });

  it("should throw NotFoundError when musician mismatch", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
    };

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      title: "Song",
      artist: "Artist",
      bpm: 120,
      key: "C",
      chords: [],
      structure_segments: null,
      lrc_provider: "lrclib",
      lrc_provider_meta: null,
      lrc_pipeline_version: 1,
      lrc_version: 1,
      lrc_quality_flags: [],
      lrc_normalized: { lines: [] },
      updated_at: new Date(),
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(input.music_library_id, SyncedLyrics),
    );
  });

  it("should build chord sheet output", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
    };

    const updatedAt = new Date("2026-01-01T00:00:00.000Z");

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: input.musician_id,
      title: "Hello",
      artist: "World",
      bpm: 120,
      key: "C",
      chords: {
        timeline: [
          { start_ms: 0, end_ms: 1000, chord: "C", confidence: 0.9 },
          { start_seconds: 1.2, chord: "G" },
        ],
      },
      structure_segments: [
        { start_seconds: 0, end_seconds: 1, label: "intro", confidence: 0.8 },
        { start_seconds: 1, end_seconds: 4, label: "verse", confidence: 0.9 },
      ],
      lrc_provider: "lrclib",
      lrc_provider_meta: { score: 0.88 },
      lrc_pipeline_version: 2,
      lrc_version: 3,
      lrc_quality_flags: ["HAS_WORD_TIMESTAMPS"],
      lrc_normalized: {
        lines: [
          { start_ms: 0, end_ms: 1000, text: "Hello, world" },
          { start_ms: 1000, end_ms: 2000, text: "Second line" },
        ],
      },
      updated_at: updatedAt,
    };

    const output = await useCase.execute(input);

    expect(output).toMatchObject({
      music_library_id: input.music_library_id,
      musician_id: input.musician_id,
      title: "Hello",
      artist: "World",
      lyrics: {
        normalized: {
          sections: [
            {
              label: "intro",
              lines: expect.arrayContaining([
                {
                  tokens: expect.any(Array),
                },
              ]),
            },
            {
              label: "verse",
              lines: expect.any(Array),
            },
          ],
        },
      },
      chords: {
        timeline: [
          expect.objectContaining({ startMs: 0, symbol: "C" }),
          expect.objectContaining({ startMs: 1200, symbol: "G" }),
        ],
      },
      alignment: {
        anchors: expect.any(Object),
      },
      meta: {
        provider: "lrclib",
        pipelineVersion: 2,
        qualityFlags: ["HAS_WORD_TIMESTAMPS"],
        bpm: 120,
        key: "C",
        matchScore: 0.88,
      },
    });

    expect(output.updated_at.toISOString()).toBe(updatedAt.toISOString());

    const firstLine = output.lyrics.normalized.sections[0].lines[0];
    const firstWord = firstLine.tokens.find((t) => t.kind === "word");
    expect(firstWord).toMatchObject({ startMs: 0 });
    expect(typeof firstWord?.endMs).toBe("number");
    expect((firstWord?.endMs as number) > 0).toBe(true);
  });

  it("should anchor chords using weighted fraction when only line timestamps exist", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205105",
    };

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: input.musician_id,
      title: "Hello",
      artist: "World",
      bpm: 120,
      key: "C",
      chords: {
        timeline: [
          { start_ms: 1500, end_ms: 2000, chord: "G", confidence: 0.9 },
        ],
      },
      structure_segments: null,
      lrc_provider: "lrclib",
      lrc_provider_meta: { score: 0.88 },
      lrc_pipeline_version: 2,
      lrc_version: 1,
      lrc_quality_flags: [],
      lrc_normalized: {
        lines: [{ start_ms: 0, end_ms: 2000, text: "Hello world" }],
      },
      updated_at: new Date(),
    };

    const output = await useCase.execute(input);
    const anchor = output.alignment.anchors["0"];
    expect(anchor).toMatchObject({ sectionIndex: 0, lineIndex: 0 });

    const line = output.lyrics.normalized.sections[0].lines[0];
    expect(line.tokens[anchor.tokenIndex]).toMatchObject({
      kind: "word",
      text: "world",
    });
  });

  // Prova, sem mockar nada em get-chord-sheet-for-music-library.use-case.ts,
  // que o caminho "Modo A" (interval matching por words[] real) já funciona
  // hoje e produz um anchor DIFERENTE do fallback proporcional por caractere
  // acima — a única peça que faltava era alguém popular words[] com dado
  // real (ver SyncedLyrics.applyWordAlignment, novo worker de alinhamento).
  // Mesma linha/acorde do teste "weighted fraction" acima, mas agora com
  // words[] real: lá o fallback proporcional escolhia "Hello" (índice 0,
  // por peso de caractere); aqui, com timestamp real por palavra, o mesmo
  // acorde em 600ms cai dentro do intervalo real de "world" (500-1000ms).
  it("should anchor chords to the exact word interval when real word-level timestamps exist", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205106",
    };

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: input.musician_id,
      title: "Hello",
      artist: "World",
      bpm: 120,
      key: "C",
      chords: {
        timeline: [
          { start_ms: 600, end_ms: 1000, chord: "G", confidence: 0.9 },
        ],
      },
      structure_segments: null,
      lrc_provider: "lrclib",
      lrc_provider_meta: { score: 0.88 },
      lrc_pipeline_version: 2,
      lrc_version: 1,
      lrc_quality_flags: ["word_aligned"],
      lrc_normalized: {
        lines: [
          {
            start_ms: 0,
            end_ms: 2000,
            text: "Hello world",
            words: [
              { start_ms: 0, end_ms: 500, text: "Hello" },
              { start_ms: 500, end_ms: 1000, text: "world" },
            ],
          },
        ],
      },
      updated_at: new Date(),
    } as any;

    const output = await useCase.execute(input);
    const anchor = output.alignment.anchors["0"];
    expect(anchor).toMatchObject({ sectionIndex: 0, lineIndex: 0 });

    const line = output.lyrics.normalized.sections[0].lines[0];
    expect(line.tokens[anchor.tokenIndex]).toMatchObject({
      kind: "word",
      text: "world",
      startMs: 500,
      endMs: 1000,
    });
  });

  it("should filter out low-confidence out-of-key chords when key is available", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205106",
    };

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: input.musician_id,
      title: "Hello",
      artist: "World",
      bpm: 120,
      key: "C",
      chords: {
        timeline: [
          { start_ms: 0, end_ms: 400, chord: "F#", confidence: 0.2 },
          { start_ms: 400, end_ms: 1800, chord: "F#", confidence: 0.9 },
          { start_ms: 1800, end_ms: 2400, chord: "G", confidence: 0.2 },
        ],
      },
      structure_segments: null,
      lrc_provider: "lrclib",
      lrc_provider_meta: { score: 0.88 },
      lrc_pipeline_version: 2,
      lrc_version: 1,
      lrc_quality_flags: [],
      lrc_normalized: {
        lines: [{ start_ms: 0, end_ms: 2400, text: "Hello world" }],
      },
      updated_at: new Date(),
    };

    const output = await useCase.execute(input);
    const symbols = output.chords.timeline.map((t) => t.symbol);
    expect(symbols).toEqual(["F#", "G"]);
  });

  it("should format maj/min worker labels into chord sheet symbols", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205107",
    };

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: input.musician_id,
      title: "Hello",
      artist: "World",
      bpm: 120,
      key: "Bb",
      chords: {
        timeline: [
          { start_ms: 0, end_ms: 1000, chord: "A#:maj", confidence: 0.9 },
          { start_ms: 1000, end_ms: 2000, chord: "A#:min", confidence: 0.9 },
        ],
      },
      structure_segments: null,
      lrc_provider: "lrclib",
      lrc_provider_meta: null,
      lrc_pipeline_version: 2,
      lrc_version: 1,
      lrc_quality_flags: [],
      lrc_normalized: {
        lines: [{ start_ms: 0, end_ms: 2000, text: "Hello world" }],
      },
      updated_at: new Date(),
    };

    const output = await useCase.execute(input);
    const symbols = output.chords.timeline.map((t) => t.symbol);
    expect(symbols).toEqual(["Bb", "Bbm"]);
  });

  it("should format worker labels with extensions and slash bass", async () => {
    const input = {
      musician_id: "550e8400-e29b-41d4-a716-446655440000",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205108",
    };

    readModel.items[input.music_library_id] = {
      id: input.music_library_id,
      musicianId: input.musician_id,
      title: "Hello",
      artist: "World",
      bpm: 120,
      key: "Bb",
      chords: {
        timeline: [
          { start_ms: 0, end_ms: 1000, chord: "A#:maj7", confidence: 0.9 },
          { start_ms: 1000, end_ms: 2000, chord: "C:min7", confidence: 0.9 },
          { start_ms: 2000, end_ms: 3000, chord: "F:maj/A#", confidence: 0.9 },
        ],
      },
      structure_segments: null,
      lrc_provider: "lrclib",
      lrc_provider_meta: null,
      lrc_pipeline_version: 2,
      lrc_version: 1,
      lrc_quality_flags: [],
      lrc_normalized: {
        lines: [{ start_ms: 0, end_ms: 3000, text: "Hello world" }],
      },
      updated_at: new Date(),
    };

    const output = await useCase.execute(input);
    const symbols = output.chords.timeline.map((t) => t.symbol);
    expect(symbols).toEqual(["Bbmaj7", "Cm7", "F/Bb"]);
  });

  /**
   * Rede de proteção da unificação com ChordSymbol (Bloco 8E, etapa 2).
   *
   * Este use-case mantinha sua própria implementação de acordes — sete métodos
   * privados que só entendiam 9 qualidades colon e só aplicavam a grafia
   * enarmônica no ramo colon. O overlay da cifra pessoal usa ChordSymbol, que
   * entende as duas notações. Duas grafias diferentes para o mesmo acorde em
   * duas rotas é o defeito que estes testes existem para impedir.
   *
   * Duração ≥ 1000ms de propósito: filterChordsByHarmonicCoherence descarta
   * acorde fora da escala que seja curto E pouco confiante, e o objetivo aqui é
   * medir formatação, não filtragem.
   */
  describe("formatação de símbolo — caracterização", () => {
    const MUSICIAN = "550e8400-e29b-41d4-a716-446655440000";

    /** Roda o use-case com um timeline sintético e devolve só os símbolos. */
    const symbolsFor = async (
      chords: Array<{ chord: string }>,
      key: string | null,
    ): Promise<string[]> => {
      const music_library_id = "9366b7dc-2d71-4799-b91c-c64adb2051ff";

      readModel.items[music_library_id] = {
        id: music_library_id,
        musicianId: MUSICIAN,
        title: "Hello",
        artist: "World",
        bpm: 120,
        key,
        chords: {
          timeline: chords.map((c, i) => ({
            start_ms: i * 2000,
            end_ms: (i + 1) * 2000,
            chord: c.chord,
            confidence: 0.9,
          })),
        },
        structure_segments: null,
        lrc_provider: "lrclib",
        lrc_provider_meta: null,
        lrc_pipeline_version: 2,
        lrc_version: 1,
        lrc_quality_flags: [],
        lrc_normalized: {
          lines: [
            {
              start_ms: 0,
              end_ms: chords.length * 2000,
              text: "Hello world",
            },
          ],
        },
        updated_at: new Date(),
      };

      const output = await useCase.execute({
        musician_id: MUSICIAN,
        music_library_id,
      });
      return output.chords.timeline.map((t) => t.symbol);
    };

    it("converte as qualidades colon conhecidas", async () => {
      expect(
        await symbolsFor(
          [
            { chord: "C:maj" },
            { chord: "A:min" },
            { chord: "G:7" },
            { chord: "D:min7" },
            { chord: "F:maj7" },
            { chord: "E:sus4" },
          ],
          "C",
        ),
      ).toEqual(["C", "Am", "G7", "Dm7", "Fmaj7", "Esus4"]);
    });

    /**
     * As qualidades que a tabela antiga NÃO conhecia. O ChordFormer emite todas
     * elas; antes da unificação vazavam cruas, com dois-pontos, para o app.
     */
    it("converte as qualidades colon que a tabela antiga não cobria", async () => {
      expect(
        await symbolsFor(
          [
            { chord: "C:dim7" },
            { chord: "B:hdim7" },
            { chord: "A:minmaj7" },
            { chord: "D:min6" },
            { chord: "F:maj6" },
            { chord: "G:9" },
          ],
          "C",
        ),
      ).toEqual(["Cdim7", "Bm7(b5)", "Am(maj7)", "Dm6", "F6", "G9"]);
    });

    it("mantém a notação de sufixo puro (não-colon) intacta", async () => {
      expect(
        await symbolsFor(
          [{ chord: "Cm7" }, { chord: "F7M" }, { chord: "G7" }],
          "C",
        ),
      ).toEqual(["Cm7", "Fmaj7", "G7"]);
    });

    it("preserva o baixo invertido nas duas notações", async () => {
      expect(
        await symbolsFor([{ chord: "F:maj/A" }, { chord: "C/E" }], "C"),
      ).toEqual(["F/A", "C/E"]);
    });

    it("descarta os marcadores de silêncio do worker", async () => {
      expect(
        await symbolsFor(
          [{ chord: "C:maj" }, { chord: "N" }, { chord: "G:maj" }],
          "C",
        ),
      ).toEqual(["C", "G"]);

      expect(
        await symbolsFor(
          [{ chord: "C:maj" }, { chord: "N.C." }, { chord: "G:maj" }],
          "C",
        ),
      ).toEqual(["C", "G"]);
    });

    /**
     * A divergência que motivou a etapa: em tom bemol, o ramo colon já grafava
     * Bb, mas o sufixo puro escapava sem preferência nenhuma — o ChordFormer
     * emite sufixo, então na prática NENHUM acorde dele recebia a grafia certa.
     */
    it("aplica a preferência enarmônica do tom nas duas notações", async () => {
      expect(await symbolsFor([{ chord: "A#:maj" }], "F")).toEqual(["Bb"]);
      expect(await symbolsFor([{ chord: "A#m7" }], "F")).toEqual(["Bbm7"]);
      expect(await symbolsFor([{ chord: "D#:min" }], "Bb")).toEqual(["Ebm"]);
    });

    it("usa sustenido quando o tom é sustenido", async () => {
      expect(await symbolsFor([{ chord: "Bb:maj" }], "D")).toEqual(["A#"]);
    });

    /** Símbolo que não entendemos nunca some da cifra — vale para as duas rotas. */
    it("preserva verbatim o símbolo não parseável", async () => {
      expect(
        await symbolsFor([{ chord: "C:zzz" }, { chord: "???" }], "C"),
      ).toEqual(["C:zzz", "???"]);
    });
  });
});
