import type { ChordSheetOutput } from "../../../../synced-lyrics/application/use-cases/common/chord-sheet-output";
import { ChordEdit } from "../../../domain/value-objects/chord-edit.vo";
import { ChordSheetViewSettings } from "../../../domain/value-objects/chord-sheet-view-settings.vo";
import {
  ChordSheetOverlayApplier,
  DEFAULT_ANCHOR_TOLERANCE_MS,
} from "../chord-sheet-overlay-applier";

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Uma linha com 4 palavras cronometradas, 1s cada. */
const line = (words: string[], startMs: number) => ({
  tokens: words.flatMap((text, i) => [
    ...(i > 0 ? [{ text: " ", kind: "space" as const, normalized: " " }] : []),
    {
      text,
      kind: "word" as const,
      normalized: text.toLowerCase(),
      startMs: startMs + i * 1000,
      endMs: startMs + (i + 1) * 1000,
    },
  ]),
});

function makeBase(overrides: Partial<ChordSheetOutput> = {}): ChordSheetOutput {
  return {
    music_library_id: "11111111-1111-1111-1111-111111111111",
    musician_id: "22222222-2222-2222-2222-222222222222",
    title: "Música de Teste",
    artist: "Artista de Teste",
    lyrics: {
      normalized: {
        sections: [
          {
            label: "Verso",
            startMs: 0,
            endMs: 8000,
            lines: [
              line(["um", "dois", "tres", "quatro"], 0),
              line(["cinco", "seis", "sete", "oito"], 4000),
            ],
          },
          {
            label: "Refrao",
            startMs: 8000,
            endMs: 16000,
            lines: [line(["nove", "dez", "onze", "doze"], 8000)],
          },
        ],
      },
    },
    chords: {
      timeline: [
        { startMs: 0, endMs: 2000, symbol: "C", confidence: 0.9 },
        { startMs: 2000, endMs: 4000, symbol: "Am", confidence: 0.8 },
        { startMs: 4000, endMs: 6000, symbol: "F", confidence: 0.95 },
        { startMs: 6000, endMs: 8000, symbol: "G", confidence: 0.7 },
        { startMs: 8000, endMs: 10000, symbol: "C", confidence: 0.9 },
      ],
    },
    alignment: { anchors: {} },
    meta: {
      provider: "lrclib",
      pipelineVersion: 1,
      qualityFlags: [],
      bpm: 120,
      key: "C",
    },
    updated_at: new Date("2026-07-28T00:00:00.000Z"),
    ...overrides,
  };
}

const view = (props = {}) => ChordSheetViewSettings.create(props);
const applier = new ChordSheetOverlayApplier();
const symbolsOf = (sheet: ChordSheetOutput) =>
  sheet.chords.timeline.map((c) => c.symbol);

describe("ChordSheetOverlayApplier", () => {
  describe("contrato básico", () => {
    it("sem edits e com view neutra, devolve o base equivalente", () => {
      const base = makeBase();
      const { sheet, outcomes, conflict_count } = applier.apply(base, {
        edits: [],
        view: view(),
      });

      expect(symbolsOf(sheet)).toEqual(["C", "Am", "F", "G", "C"]);
      expect(outcomes).toEqual([]);
      expect(conflict_count).toBe(0);
    });

    it("devolve o mesmo formato do base — o cliente não muda", () => {
      const { sheet } = applier.apply(makeBase(), { edits: [], view: view() });

      expect(sheet).toHaveProperty("lyrics.normalized.sections");
      expect(sheet).toHaveProperty("chords.timeline");
      expect(sheet).toHaveProperty("alignment.anchors");
      expect(sheet).toHaveProperty("meta");
      expect(sheet.music_library_id).toBe(makeBase().music_library_id);
    });

    it("marca a folha como tendo overlay pessoal", () => {
      const { sheet } = applier.apply(makeBase(), { edits: [], view: view() });
      expect(sheet.meta.qualityFlags).toContain("personal_overlay");
    });
  });

  /** A propriedade que impede corromper a cifra canônica servida a todos. */
  describe("não-mutação do base", () => {
    it("não altera o objeto de entrada, nem em profundidade", () => {
      const base = makeBase();
      const snapshot = JSON.parse(JSON.stringify(base));

      applier.apply(base, {
        edits: [
          ChordEdit.replaceChord({ at_ms: 2000, from: "Am", to: "Am7" }),
          ChordEdit.insertChord({ at_ms: 3000, symbol: "Dm" }),
          ChordEdit.deleteChord({ at_ms: 6000, from: "G" }),
          ChordEdit.relabelSection({ section_start_ms: 8000, label: "Ponte" }),
        ],
        view: view({ transpose_semitones: 2, chord_complexity: "simple" }),
      });

      expect(JSON.parse(JSON.stringify(base))).toEqual(snapshot);
    });

    it("a folha devolvida não compartilha referência com o base", () => {
      const base = makeBase();
      const { sheet } = applier.apply(base, { edits: [], view: view() });

      expect(sheet).not.toBe(base);
      expect(sheet.chords.timeline).not.toBe(base.chords.timeline);
      expect(sheet.lyrics.normalized.sections).not.toBe(
        base.lyrics.normalized.sections,
      );
    });
  });

  describe("replace_chord", () => {
    it("substitui o acorde casado", () => {
      const { sheet, outcomes } = applier.apply(makeBase(), {
        edits: [ChordEdit.replaceChord({ at_ms: 2000, from: "Am", to: "Am7" })],
        view: view(),
      });

      expect(symbolsOf(sheet)).toEqual(["C", "Am7", "F", "G", "C"]);
      expect(outcomes[0]).toMatchObject({
        status: "applied",
        matched_start_ms: 2000,
      });
    });

    it("casa dentro da janela de tolerância", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [
          ChordEdit.replaceChord({
            at_ms: 2000 + DEFAULT_ANCHOR_TOLERANCE_MS,
            from: "Am",
            to: "Am7",
          }),
        ],
        view: view(),
      });

      expect(symbolsOf(sheet)[1]).toBe("Am7");
    });

    it("conflita 1ms fora da janela", () => {
      const { sheet, outcomes, conflict_count } = applier.apply(makeBase(), {
        edits: [
          ChordEdit.replaceChord({
            at_ms: 2000 + DEFAULT_ANCHOR_TOLERANCE_MS + 1,
            from: "Am",
            to: "Am7",
          }),
        ],
        view: view(),
      });

      expect(symbolsOf(sheet)).toEqual(["C", "Am", "F", "G", "C"]);
      expect(outcomes[0]).toMatchObject({
        status: "conflict",
        reason: "anchor_not_found",
      });
      expect(conflict_count).toBe(1);
    });

    it("conflita com symbol_mismatch quando o acorde na janela é outro", () => {
      const { outcomes } = applier.apply(makeBase(), {
        edits: [ChordEdit.replaceChord({ at_ms: 2000, from: "Bm", to: "Bm7" })],
        view: view(),
      });

      expect(outcomes[0]).toMatchObject({
        status: "conflict",
        reason: "symbol_mismatch",
      });
    });

    it("casa por equivalência enarmônica — correção em Db acha o C# da IA", () => {
      const base = makeBase({
        chords: { timeline: [{ startMs: 0, endMs: 2000, symbol: "C#m" }] },
      });
      const { sheet, outcomes } = applier.apply(base, {
        edits: [ChordEdit.replaceChord({ at_ms: 0, from: "Dbm", to: "Dbm7" })],
        view: view(),
      });

      expect(outcomes[0].status).toBe("applied");
      expect(symbolsOf(sheet)).toEqual(["Dbm7"]);
    });

    it("remove a confidence do acorde corrigido — correção humana não é filtrável", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [ChordEdit.replaceChord({ at_ms: 2000, from: "Am", to: "Am7" })],
        view: view(),
      });

      expect(sheet.chords.timeline[1]).not.toHaveProperty("confidence");
    });
  });

  describe("insert_chord e delete_chord", () => {
    it("insere um acorde na posição temporal correta", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [ChordEdit.insertChord({ at_ms: 3000, symbol: "Dm" })],
        view: view(),
      });

      expect(symbolsOf(sheet)).toEqual(["C", "Am", "Dm", "F", "G", "C"]);
      expect(sheet.chords.timeline[2].startMs).toBe(3000);
    });

    /**
     * Insert não precisa CASAR com nada: o músico está acrescentando o que a IA
     * não viu, então nunca dá anchor_not_found nem symbol_mismatch.
     */
    it("insert não conflita por falta de âncora", () => {
      const { outcomes } = applier.apply(makeBase(), {
        // 5000ms cai num vão entre acordes — nenhum startMs por perto.
        edits: [ChordEdit.insertChord({ at_ms: 5000, symbol: "Dm" })],
        view: view(),
      });

      expect(outcomes[0].status).toBe("applied");
    });

    /**
     * ...mas precisa cair DENTRO da música. Antes, um at_ms absurdo entrava no
     * timeline e o normalizeTimeline reencadeava os endMs em volta dele,
     * deformando a cifra inteira por causa de um único edit.
     */
    it("insert fora da duração da música vira conflito out_of_range", () => {
      const base = makeBase(); // termina em 10000ms
      const { sheet, outcomes } = applier.apply(base, {
        edits: [ChordEdit.insertChord({ at_ms: 9_999_999, symbol: "Dm" })],
        view: view(),
      });

      expect(outcomes[0]).toMatchObject({
        status: "conflict",
        reason: "out_of_range",
      });
      // e o timeline sai intacto — nada de acorde fantasma no fim
      expect(symbolsOf(sheet)).toEqual(["C", "Am", "F", "G", "C"]);
    });

    it("aceita insert na janela de tolerância depois do último acorde", () => {
      const { outcomes } = applier.apply(makeBase(), {
        edits: [
          ChordEdit.insertChord({
            at_ms: 10_000 + DEFAULT_ANCHOR_TOLERANCE_MS,
            symbol: "Dm",
          }),
        ],
        view: view(),
      });

      expect(outcomes[0].status).toBe("applied");
    });

    /** Sem timeline não há duração conhecida — recusar tudo seria pior. */
    it("aceita insert quando o base não tem timeline", () => {
      const base = makeBase();
      base.chords = { timeline: [] };

      const { outcomes } = applier.apply(base, {
        edits: [ChordEdit.insertChord({ at_ms: 4000, symbol: "Dm" })],
        view: view(),
      });

      expect(outcomes[0].status).toBe("applied");
    });

    it("remove o acorde casado", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [ChordEdit.deleteChord({ at_ms: 4000, from: "F" })],
        view: view(),
      });

      expect(symbolsOf(sheet)).toEqual(["C", "Am", "G", "C"]);
    });

    it("após um delete, nenhum acorde invade o próximo", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [ChordEdit.deleteChord({ at_ms: 4000, from: "F" })],
        view: view(),
      });

      const [c, am, g] = sheet.chords.timeline;
      expect(c.endMs).toBe(2000);
      // O acorde anterior NÃO é esticado para cobrir o buraco: a regra
      // replicada de buildChords só trunca sobreposição, nunca preenche
      // silêncio. Esticar seria inventar harmonia que ninguém tocou.
      expect(am.endMs).toBe(4000);
      expect(g.startMs).toBe(6000);
    });

    it("re-encadeia endMs após um insert, sem sobreposição", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [ChordEdit.insertChord({ at_ms: 3000, symbol: "Dm" })],
        view: view(),
      });

      const timeline = sheet.chords.timeline;
      for (let i = 0; i < timeline.length - 1; i++) {
        expect(timeline[i].endMs).toBeLessThanOrEqual(timeline[i + 1].startMs);
      }
    });
  });

  describe("shift_chord", () => {
    it("move o acorde preservando a duração", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [
          ChordEdit.shiftChord({ at_ms: 2000, to_ms: 2500, symbol: "Am" }),
        ],
        view: view(),
      });

      const am = sheet.chords.timeline.find((c) => c.symbol === "Am")!;
      expect(am.startMs).toBe(2500);
    });

    it("reordena o timeline quando o shift ultrapassa o vizinho", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [
          ChordEdit.shiftChord({ at_ms: 2000, to_ms: 5000, symbol: "Am" }),
        ],
        view: view(),
      });

      const starts = sheet.chords.timeline.map((c) => c.startMs);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
    });
  });

  describe("relabel_section", () => {
    it("renomeia a seção casada por tempo", () => {
      const { sheet, outcomes } = applier.apply(makeBase(), {
        edits: [
          ChordEdit.relabelSection({ section_start_ms: 8000, label: "Ponte" }),
        ],
        view: view(),
      });

      expect(sheet.lyrics.normalized.sections[1].label).toBe("Ponte");
      expect(sheet.lyrics.normalized.sections[0].label).toBe("Verso");
      expect(outcomes[0].status).toBe("applied");
    });

    it("conflita quando nenhuma seção começa perto", () => {
      const { outcomes } = applier.apply(makeBase(), {
        edits: [
          ChordEdit.relabelSection({ section_start_ms: 99999, label: "X" }),
        ],
        view: view(),
      });

      expect(outcomes[0]).toMatchObject({
        status: "conflict",
        reason: "anchor_not_found",
      });
    });
  });

  describe("annotate", () => {
    it("ancora a anotação num token da letra", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [ChordEdit.annotate({ at_ms: 5000, text: "solo entra aqui" })],
        view: view(),
      });

      expect(sheet.annotations).toHaveLength(1);
      expect(sheet.annotations![0]).toMatchObject({
        atMs: 5000,
        text: "solo entra aqui",
      });
      expect(typeof sheet.annotations![0].sectionIndex).toBe("number");
      expect(typeof sheet.annotations![0].tokenIndex).toBe("number");
    });

    it("não cria o campo annotations quando não há anotações", () => {
      const { sheet } = applier.apply(makeBase(), { edits: [], view: view() });
      expect(sheet.annotations).toBeUndefined();
    });

    it("ancora várias anotações independentemente", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [
          ChordEdit.annotate({ at_ms: 1000, text: "primeira" }),
          ChordEdit.annotate({ at_ms: 9000, text: "segunda" }),
        ],
        view: view(),
      });

      expect(sheet.annotations!.map((a) => a.text)).toEqual([
        "primeira",
        "segunda",
      ]);
      expect(sheet.annotations![0].sectionIndex).toBe(0);
      expect(sheet.annotations![1].sectionIndex).toBe(1);
    });
  });

  /**
   * O bug mais perigoso do overlay: anchors é indexado POSICIONALMENTE no
   * timeline. Sem reancorar, um insert desloca todos os acordes seguintes para a
   * sílaba errada — em silêncio, do ponto da edição até o fim da música.
   */
  describe("reancoragem de alignment.anchors", () => {
    it("gera uma âncora por acorde, sempre", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [
          ChordEdit.insertChord({ at_ms: 3000, symbol: "Dm" }),
          ChordEdit.deleteChord({ at_ms: 6000, from: "G" }),
        ],
        view: view(),
      });

      expect(Object.keys(sheet.alignment.anchors)).toHaveLength(
        sheet.chords.timeline.length,
      );
      expect(Object.keys(sheet.alignment.anchors).sort()).toEqual(
        sheet.chords.timeline.map((_, i) => String(i)).sort(),
      );
    });

    it("cada acorde continua ancorado no token do seu próprio tempo após insert+delete", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [
          ChordEdit.insertChord({ at_ms: 3000, symbol: "Dm" }),
          ChordEdit.deleteChord({ at_ms: 2000, from: "Am" }),
        ],
        view: view(),
      });

      sheet.chords.timeline.forEach((chord, index) => {
        const anchor = sheet.alignment.anchors[String(index)];
        const section = sheet.lyrics.normalized.sections[anchor.sectionIndex];
        const token = section.lines[anchor.lineIndex].tokens[anchor.tokenIndex];

        // O token ancorado tem que começar em ou antes do acorde, dentro da
        // mesma seção — nunca "sobrar" para a sílaba seguinte.
        expect(section.startMs!).toBeLessThanOrEqual(chord.startMs);
        expect(token.startMs!).toBeLessThanOrEqual(chord.startMs + 1000);
      });
    });

    it("acordes da segunda seção ancoram na segunda seção", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [ChordEdit.insertChord({ at_ms: 1000, symbol: "Dm" })],
        view: view(),
      });

      const ultimoIndex = sheet.chords.timeline.length - 1;
      expect(sheet.chords.timeline[ultimoIndex].startMs).toBe(8000);
      expect(sheet.alignment.anchors[String(ultimoIndex)].sectionIndex).toBe(1);
    });
  });

  describe("determinismo", () => {
    it("a mesma lista embaralhada 10 vezes produz resultado idêntico", () => {
      const edits = [
        ChordEdit.replaceChord({ at_ms: 2000, from: "Am", to: "Am7" }),
        ChordEdit.insertChord({ at_ms: 3000, symbol: "Dm" }),
        ChordEdit.deleteChord({ at_ms: 6000, from: "G" }),
        ChordEdit.annotate({ at_ms: 5000, text: "nota" }),
        ChordEdit.relabelSection({ section_start_ms: 8000, label: "Ponte" }),
        ChordEdit.shiftChord({ at_ms: 4000, to_ms: 4200, symbol: "F" }),
      ];

      const referencia = JSON.stringify(
        applier.apply(makeBase(), { edits, view: view() }).sheet,
      );

      for (let i = 0; i < 10; i++) {
        const embaralhado = [...edits].sort(() => Math.random() - 0.5);
        const resultado = JSON.stringify(
          applier.apply(makeBase(), { edits: embaralhado, view: view() }).sheet,
        );
        expect(resultado).toBe(referencia);
      }
    });

    it("edits no mesmo instante aplicam delete antes de insert", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [
          ChordEdit.insertChord({ at_ms: 2000, symbol: "Dm" }),
          ChordEdit.deleteChord({ at_ms: 2000, from: "Am" }),
        ],
        view: view(),
      });

      // O delete casou o Am original; o insert entrou depois e sobreviveu.
      expect(symbolsOf(sheet)).toEqual(["C", "Dm", "F", "G", "C"]);
    });
  });

  describe("transposição e capotraste", () => {
    it("transpõe todos os acordes", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [],
        view: view({ transpose_semitones: 2 }),
      });

      expect(symbolsOf(sheet)).toEqual(["D", "Bm", "G", "A", "D"]);
    });

    it("capotraste sozinho ABAIXA as formas exibidas, na grafia do tom de destino", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [],
        view: view({ capo_fret: 2 }),
      });

      // C com capô na 2ª casa → formas de Bb. Escreve-se Bb/Eb, não A#/D#:
      // Bb maior é tonalidade de bemóis. É o que qualquer app de cifra mostra.
      expect(symbolsOf(sheet)).toEqual(["Bb", "Gm", "Eb", "F", "Bb"]);
      expect(sheet.meta.key).toBe("Bb");
    });

    it("transpor +2 com capô 2 devolve as formas originais", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [],
        view: view({ transpose_semitones: 2, capo_fret: 2 }),
      });

      expect(symbolsOf(sheet)).toEqual(["C", "Am", "F", "G", "C"]);
    });

    it("transpõe meta.key junto com os acordes", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [],
        view: view({ transpose_semitones: 2 }),
      });

      expect(sheet.meta.key).toBe("D");
    });

    it("resolve a grafia pela tonalidade de destino — C+3 vira Eb, não D#", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [],
        view: view({ transpose_semitones: 3 }),
      });

      expect(sheet.meta.key).toBe("Eb");
      expect(symbolsOf(sheet)).toEqual(["Eb", "Cm", "Ab", "Bb", "Eb"]);
    });

    it("respeita a preferência explícita por sustenido", () => {
      const { sheet } = applier.apply(makeBase(), {
        edits: [],
        view: view({ transpose_semitones: 3, preferred_accidental: "sharp" }),
      });

      expect(symbolsOf(sheet)).toEqual(["D#", "Cm", "G#", "A#", "D#"]);
    });

    it("preserva verbatim um símbolo que não sabe parsear", () => {
      const base = makeBase({
        chords: {
          timeline: [
            { startMs: 0, endMs: 1000, symbol: "C" },
            { startMs: 1000, endMs: 2000, symbol: "???exótico" },
          ],
        },
      });
      const { sheet } = applier.apply(base, {
        edits: [],
        view: view({ transpose_semitones: 2 }),
      });

      expect(symbolsOf(sheet)).toEqual(["D", "???exótico"]);
    });

    it("avisa quando um edit não parseável fica no tom errado", () => {
      const { outcomes } = applier.apply(makeBase(), {
        edits: [ChordEdit.insertChord({ at_ms: 3000, symbol: "??x" })],
        view: view({ transpose_semitones: 2 }),
      });

      expect(outcomes[0]).toMatchObject({
        status: "applied",
        reason: "unparseable_symbol",
      });
    });

    it("não avisa de símbolo não parseável quando não há transposição", () => {
      const { outcomes } = applier.apply(makeBase(), {
        edits: [ChordEdit.insertChord({ at_ms: 3000, symbol: "??x" })],
        view: view(),
      });

      expect(outcomes[0].reason).toBeUndefined();
    });
  });

  describe("simplificação de acordes", () => {
    const complexBase = makeBase({
      chords: {
        timeline: [
          { startMs: 0, endMs: 2000, symbol: "Cmaj9" },
          { startMs: 2000, endMs: 4000, symbol: "Am11" },
          { startMs: 4000, endMs: 6000, symbol: "F#m7(b5)" },
          { startMs: 6000, endMs: 8000, symbol: "G7(b9)" },
        ],
      },
    });

    it("simple remove extensões e alterações", () => {
      const { sheet } = applier.apply(complexBase, {
        edits: [],
        view: view({ chord_complexity: "simple" }),
      });

      expect(symbolsOf(sheet)).toEqual(["Cmaj7", "Am7", "F#m7", "G7"]);
    });

    it("basic reduz tudo à tríade", () => {
      const { sheet } = applier.apply(complexBase, {
        edits: [],
        view: view({ chord_complexity: "basic" }),
      });

      expect(symbolsOf(sheet)).toEqual(["C", "Am", "F#dim", "G"]);
    });

    it("combina simplificação com transposição", () => {
      const { sheet } = applier.apply(complexBase, {
        edits: [],
        view: view({ chord_complexity: "basic", transpose_semitones: 2 }),
      });

      expect(symbolsOf(sheet)).toEqual(["D", "Bm", "G#dim", "A"]);
    });

    /*
     * 🔴 O músico corrige o que VÊ. Com "acordes básicos" a tela mostra "Am"
     * onde o base é "Am11"; exigir o símbolo base no `from` fazia toda correção
     * feita com simplificação ligada virar `symbol_mismatch` — "cliquei em
     * corrigir e nada aconteceu".
     */
    it("corrigir o acorde SIMPLIFICADO casa com o base complexo", () => {
      const { sheet, outcomes } = applier.apply(complexBase, {
        edits: [ChordEdit.replaceChord({ at_ms: 2000, from: "Am", to: "Dm7" })],
        view: view({ chord_complexity: "basic" }),
      });

      expect(outcomes[0]).toMatchObject({ status: "applied" });
      expect(symbolsOf(sheet)[1]).toBe("Dm");
    });

    it("a correção sobrevive a trocar a simplificação depois", () => {
      const edits = [
        ChordEdit.replaceChord({ at_ms: 2000, from: "Am7", to: "Dm7" }),
      ];

      const { outcomes } = applier.apply(complexBase, {
        edits,
        view: view({ chord_complexity: "full" }),
      });

      expect(outcomes[0]).toMatchObject({ status: "applied" });
    });

    it("mas não casa acorde de OUTRA fundamental ou qualidade", () => {
      const { outcomes } = applier.apply(complexBase, {
        edits: [ChordEdit.replaceChord({ at_ms: 2000, from: "A", to: "Dm7" })],
        view: view({ chord_complexity: "basic" }),
      });

      expect(outcomes[0].status).not.toBe("applied");
    });
  });

  describe("casos degenerados", () => {
    it("lida com timeline vazio", () => {
      const base = makeBase({ chords: { timeline: [] } });
      const { sheet, outcomes } = applier.apply(base, {
        edits: [ChordEdit.replaceChord({ at_ms: 0, from: "C", to: "C7" })],
        view: view({ transpose_semitones: 2 }),
      });

      expect(sheet.chords.timeline).toEqual([]);
      expect(outcomes[0].reason).toBe("anchor_not_found");
    });

    it("lida com letra sem seções", () => {
      const base = makeBase({ lyrics: { normalized: { sections: [] } } });
      const { sheet } = applier.apply(base, {
        edits: [ChordEdit.annotate({ at_ms: 1000, text: "nota" })],
        view: view(),
      });

      expect(sheet.annotations).toHaveLength(1);
      expect(Object.keys(sheet.alignment.anchors)).toHaveLength(5);
    });

    it("transpõe tonalidade escrita por extenso", () => {
      const base = makeBase({
        meta: { ...makeBase().meta, key: "C major" },
      });
      const { sheet } = applier.apply(base, {
        edits: [],
        view: view({ transpose_semitones: 3 }),
      });

      expect(sheet.meta.key).toBe("Eb");
      expect(symbolsOf(sheet)).toEqual(["Eb", "Cm", "Ab", "Bb", "Eb"]);
    });

    it("lida com meta.key nulo", () => {
      const base = makeBase({
        meta: { ...makeBase().meta, key: null },
      });
      const { sheet } = applier.apply(base, {
        edits: [],
        view: view({ transpose_semitones: 2 }),
      });

      expect(sheet.meta.key).toBeNull();
      expect(symbolsOf(sheet)).toEqual(["D", "Bm", "G", "A", "D"]);
    });

    it("conflita com ambiguous_match em empate exato entre grafias distintas", () => {
      // Os dois casam enarmonicamente com "C#" e estão à mesma distância.
      // Aplicar em qualquer um dos dois seria adivinhação — melhor perguntar.
      const base = makeBase({
        chords: {
          timeline: [
            { startMs: 900, endMs: 1000, symbol: "C#" },
            { startMs: 1100, endMs: 1200, symbol: "Db" },
          ],
        },
      });
      const { sheet, outcomes } = applier.apply(base, {
        edits: [ChordEdit.deleteChord({ at_ms: 1000, from: "C#" })],
        view: view(),
      });

      expect(outcomes[0]).toMatchObject({
        status: "conflict",
        reason: "ambiguous_match",
      });
      expect(sheet.chords.timeline).toHaveLength(2);
    });

    it("não conflita em empate quando os dois candidatos são o mesmo símbolo", () => {
      // Escolher qualquer um dá o mesmo resultado — não há o que perguntar.
      const base = makeBase({
        chords: {
          timeline: [
            { startMs: 900, endMs: 1000, symbol: "C" },
            { startMs: 1100, endMs: 1200, symbol: "C" },
          ],
        },
      });
      const { sheet, outcomes } = applier.apply(base, {
        edits: [ChordEdit.deleteChord({ at_ms: 1000, from: "C" })],
        view: view(),
      });

      expect(outcomes[0].status).toBe("applied");
      expect(sheet.chords.timeline).toHaveLength(1);
    });
  });

  describe("casamento com a forma simplificada (25/set/2026)", () => {
    it("com 'acordes simples' a tela mostra Am onde o base é Am7 — corrigir casa", () => {
      const base = makeBase({
        chords: { timeline: [{ startMs: 0, endMs: 2000, symbol: "Am7" }] },
      });
      const { sheet, conflict_count } = applier.apply(base, {
        edits: [ChordEdit.replaceChord({ at_ms: 0, from: "Am", to: "Dm" })],
        view: view(),
      });

      expect(conflict_count).toBe(0);
      expect(symbolsOf(sheet)).toEqual(["Dm"]);
    });

    it("acorde de outra raiz continua sendo conflito", () => {
      const base = makeBase({
        chords: { timeline: [{ startMs: 0, endMs: 2000, symbol: "Am7" }] },
      });
      const { conflict_count } = applier.apply(base, {
        edits: [ChordEdit.replaceChord({ at_ms: 0, from: "Em", to: "Dm" })],
        view: view(),
      });

      expect(conflict_count).toBe(1);
    });
  });
});
