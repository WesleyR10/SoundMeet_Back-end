import { createHash } from "crypto";

import type { ChordSheetChordTimelineItemOutput } from "../../../../synced-lyrics/application/use-cases/common/chord-sheet-output";
import {
  CHORD_SHEET_FINGERPRINT_VERSION,
  computeChordSheetBaseFingerprint,
} from "../chord-sheet-fingerprint";

const timeline = (
  items: Array<Partial<ChordSheetChordTimelineItemOutput>>,
): ChordSheetChordTimelineItemOutput[] =>
  items.map((i) => ({
    startMs: i.startMs ?? 0,
    symbol: i.symbol ?? "C",
    ...(i.endMs !== undefined ? { endMs: i.endMs } : {}),
    ...(i.confidence !== undefined ? { confidence: i.confidence } : {}),
  }));

const BASE = timeline([
  { startMs: 0, endMs: 2000, symbol: "C" },
  { startMs: 2000, endMs: 4000, symbol: "Am" },
  { startMs: 4000, endMs: 6000, symbol: "F" },
  { startMs: 6000, endMs: 8000, symbol: "G" },
]);

describe("computeChordSheetBaseFingerprint", () => {
  describe("determinismo", () => {
    it("duas chamadas com a mesma entrada dão o mesmo hash", () => {
      expect(computeChordSheetBaseFingerprint(BASE)).toBe(
        computeChordSheetBaseFingerprint(BASE),
      );
    });

    it("devolve sha256 hex de 64 caracteres", () => {
      expect(computeChordSheetBaseFingerprint(BASE)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("timeline vazio produz um hash estável", () => {
      const empty = computeChordSheetBaseFingerprint([]);
      expect(empty).toMatch(/^[0-9a-f]{64}$/);
      expect(empty).toBe(computeChordSheetBaseFingerprint([]));
    });

    it("independe da ordem das chaves do objeto", () => {
      const a: ChordSheetChordTimelineItemOutput[] = [
        { startMs: 0, endMs: 1000, symbol: "C", confidence: 0.9 },
      ];
      const b: ChordSheetChordTimelineItemOutput[] = [
        { confidence: 0.9, symbol: "C", endMs: 1000, startMs: 0 } as never,
      ];
      expect(computeChordSheetBaseFingerprint(a)).toBe(
        computeChordSheetBaseFingerprint(b),
      );
    });
  });

  /**
   * A propriedade que impede o "incidente de reconciliação em massa": um ajuste
   * de threshold no modelo muda confidence de toda música do catálogo. Se o
   * fingerprint reagisse a isso, TODOS os forks do sistema seriam marcados como
   * desatualizados de uma vez, sem nenhuma mudança real de acorde.
   */
  describe("insensível a confidence", () => {
    it("ignora confidence presente vs ausente", () => {
      const semConfidence = timeline([
        { startMs: 0, endMs: 2000, symbol: "C" },
        { startMs: 2000, endMs: 4000, symbol: "Am" },
      ]);
      const comConfidence = timeline([
        { startMs: 0, endMs: 2000, symbol: "C", confidence: 0.42 },
        { startMs: 2000, endMs: 4000, symbol: "Am", confidence: 0.99 },
      ]);

      expect(computeChordSheetBaseFingerprint(semConfidence)).toBe(
        computeChordSheetBaseFingerprint(comConfidence),
      );
    });

    it("ignora variação de confidence entre execuções do mesmo modelo", () => {
      const run1 = timeline([{ startMs: 0, symbol: "C", confidence: 0.8123 }]);
      const run2 = timeline([{ startMs: 0, symbol: "C", confidence: 0.8124 }]);

      expect(computeChordSheetBaseFingerprint(run1)).toBe(
        computeChordSheetBaseFingerprint(run2),
      );
    });
  });

  describe("sensível ao que importa", () => {
    it("muda quando um símbolo muda", () => {
      const alterado = timeline([
        { startMs: 0, endMs: 2000, symbol: "C" },
        { startMs: 2000, endMs: 4000, symbol: "Am7" }, // era Am
        { startMs: 4000, endMs: 6000, symbol: "F" },
        { startMs: 6000, endMs: 8000, symbol: "G" },
      ]);
      expect(computeChordSheetBaseFingerprint(alterado)).not.toBe(
        computeChordSheetBaseFingerprint(BASE),
      );
    });

    it("muda quando um startMs muda", () => {
      const alterado = timeline([
        { startMs: 0, endMs: 2000, symbol: "C" },
        { startMs: 2500, endMs: 4000, symbol: "Am" },
        { startMs: 4000, endMs: 6000, symbol: "F" },
        { startMs: 6000, endMs: 8000, symbol: "G" },
      ]);
      expect(computeChordSheetBaseFingerprint(alterado)).not.toBe(
        computeChordSheetBaseFingerprint(BASE),
      );
    });

    it("muda quando um endMs muda", () => {
      const alterado = timeline([
        { startMs: 0, endMs: 2500, symbol: "C" },
        { startMs: 2000, endMs: 4000, symbol: "Am" },
        { startMs: 4000, endMs: 6000, symbol: "F" },
        { startMs: 6000, endMs: 8000, symbol: "G" },
      ]);
      expect(computeChordSheetBaseFingerprint(alterado)).not.toBe(
        computeChordSheetBaseFingerprint(BASE),
      );
    });

    it("muda quando a ordem muda", () => {
      const reordenado = [BASE[1], BASE[0], BASE[2], BASE[3]];
      expect(computeChordSheetBaseFingerprint(reordenado)).not.toBe(
        computeChordSheetBaseFingerprint(BASE),
      );
    });

    it("muda quando um acorde é inserido", () => {
      const comInsercao = [
        ...BASE,
        timeline([{ startMs: 8000, symbol: "C" }])[0],
      ];
      expect(computeChordSheetBaseFingerprint(comInsercao)).not.toBe(
        computeChordSheetBaseFingerprint(BASE),
      );
    });

    it("muda quando um acorde é removido", () => {
      expect(computeChordSheetBaseFingerprint(BASE.slice(0, 3))).not.toBe(
        computeChordSheetBaseFingerprint(BASE),
      );
    });

    it("distingue grafias enarmônicas — C# e Db são símbolos diferentes no base", () => {
      const sustenido = timeline([{ startMs: 0, symbol: "C#" }]);
      const bemol = timeline([{ startMs: 0, symbol: "Db" }]);
      expect(computeChordSheetBaseFingerprint(sustenido)).not.toBe(
        computeChordSheetBaseFingerprint(bemol),
      );
    });
  });

  describe("robustez a dados sujos", () => {
    it("não quebra com campos ausentes ou de tipo errado", () => {
      const sujo = [
        { startMs: "0", symbol: null },
        {},
        { startMs: NaN, symbol: "C" },
      ] as unknown as ChordSheetChordTimelineItemOutput[];

      expect(() => computeChordSheetBaseFingerprint(sujo)).not.toThrow();
      expect(computeChordSheetBaseFingerprint(sujo)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("ignora espaços em volta do símbolo", () => {
      expect(
        computeChordSheetBaseFingerprint(
          timeline([{ startMs: 0, symbol: " C " }]),
        ),
      ).toBe(
        computeChordSheetBaseFingerprint(
          timeline([{ startMs: 0, symbol: "C" }]),
        ),
      );
    });
  });

  describe("versionamento do algoritmo", () => {
    it("a versão vigente está declarada", () => {
      expect(CHORD_SHEET_FINGERPRINT_VERSION).toBe(1);
    });

    it("o hash é sha256 da string canônica com prefixo de versão", () => {
      // Fixa o contrato do material hasheado: mudar o prefixo de versão muda o
      // fingerprint de TODOS os forks do sistema de uma vez. Este teste existe
      // para que essa consequência seja uma decisão, nunca um acidente.
      const canonica = `v${CHORD_SHEET_FINGERPRINT_VERSION}|0:2000:C;2000:4000:Am;4000:6000:F;6000:8000:G`;
      const esperado = createHash("sha256")
        .update(canonica, "utf8")
        .digest("hex");

      expect(computeChordSheetBaseFingerprint(BASE)).toBe(esperado);
    });
  });
});
