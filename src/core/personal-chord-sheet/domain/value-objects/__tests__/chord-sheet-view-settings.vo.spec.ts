import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  ChordSheetViewSettings,
  MAX_CAPO_FRET,
  MAX_TRANSPOSE_SEMITONES,
  MIN_TRANSPOSE_SEMITONES,
} from "../chord-sheet-view-settings.vo";

describe("ChordSheetViewSettings Value Object", () => {
  describe("default", () => {
    it("nasce neutro", () => {
      const view = ChordSheetViewSettings.default();

      expect(view.transpose_semitones).toBe(0);
      expect(view.capo_fret).toBe(0);
      expect(view.chord_complexity).toBe("full");
      expect(view.instrument).toBe("guitar");
      expect(view.left_handed).toBe(false);
      expect(view.preferred_accidental).toBe("auto");
      expect(view.scroll_speed).toBe(1);
    });

    it("o default é identidade", () => {
      expect(ChordSheetViewSettings.default().isIdentity()).toBe(true);
    });
  });

  /**
   * Esta é a conta que, se inverter o sinal, faz o violonista tocar meio tom
   * acima a noite inteira sem ninguém entender por quê.
   */
  describe("effectiveDisplaySemitones — o sinal do capotraste", () => {
    it.each<[number, number, number]>([
      [2, 2, 0],
      [0, 3, -3],
      [0, 0, 0],
      [2, 0, 2],
      [-2, 0, -2],
      [5, 2, 3],
      [-3, 2, -5],
      [11, 12, -1],
    ])(
      "transpose=%s, capo=%s → %s",
      (transpose_semitones, capo_fret, expected) => {
        const view = ChordSheetViewSettings.create({
          transpose_semitones,
          capo_fret,
        });
        expect(view.effectiveDisplaySemitones()).toBe(expected);
      },
    );

    it("capotraste sozinho ABAIXA as formas exibidas", () => {
      const view = ChordSheetViewSettings.create({ capo_fret: 2 });
      expect(view.effectiveDisplaySemitones()).toBeLessThan(0);
    });

    it("transposição sozinha SOBE as formas exibidas", () => {
      const view = ChordSheetViewSettings.create({ transpose_semitones: 2 });
      expect(view.effectiveDisplaySemitones()).toBeGreaterThan(0);
    });
  });

  describe("isIdentity", () => {
    it("é identidade quando transpose e capo se cancelam e a complexidade é full", () => {
      const view = ChordSheetViewSettings.create({
        transpose_semitones: 3,
        capo_fret: 3,
      });
      expect(view.isIdentity()).toBe(true);
    });

    it("não é identidade quando a complexidade muda, mesmo sem transposição", () => {
      const view = ChordSheetViewSettings.create({
        chord_complexity: "simple",
      });
      expect(view.effectiveDisplaySemitones()).toBe(0);
      expect(view.isIdentity()).toBe(false);
    });

    it("não é identidade quando há transposição efetiva", () => {
      expect(
        ChordSheetViewSettings.create({ transpose_semitones: 1 }).isIdentity(),
      ).toBe(false);
    });
  });

  describe("with — patch parcial imutável", () => {
    it("não muta a instância original", () => {
      const original = ChordSheetViewSettings.default();
      const patched = original.with({ transpose_semitones: 5 });

      expect(original.transpose_semitones).toBe(0);
      expect(patched.transpose_semitones).toBe(5);
      expect(patched).not.toBe(original);
    });

    it("preserva os campos não informados", () => {
      const view = ChordSheetViewSettings.create({
        transpose_semitones: 3,
        instrument: "ukulele",
        left_handed: true,
      }).with({ capo_fret: 2 });

      expect(view.transpose_semitones).toBe(3);
      expect(view.instrument).toBe("ukulele");
      expect(view.left_handed).toBe(true);
      expect(view.capo_fret).toBe(2);
    });

    it("aceita desligar um booleano", () => {
      const view = ChordSheetViewSettings.create({ left_handed: true }).with({
        left_handed: false,
      });
      expect(view.left_handed).toBe(false);
    });
  });

  describe("validação de faixas", () => {
    it.each([
      MIN_TRANSPOSE_SEMITONES - 1,
      MAX_TRANSPOSE_SEMITONES + 1,
      100,
      -100,
    ])("rejeita transpose_semitones fora da faixa: %s", (value) => {
      expect(() =>
        ChordSheetViewSettings.create({ transpose_semitones: value }),
      ).toThrow(EntityValidationError);
    });

    it.each([-1, MAX_CAPO_FRET + 1, 20])(
      "rejeita capo_fret fora da faixa: %s",
      (value) => {
        expect(() =>
          ChordSheetViewSettings.create({ capo_fret: value }),
        ).toThrow(EntityValidationError);
      },
    );

    it("rejeita transpose fracionário", () => {
      expect(() =>
        ChordSheetViewSettings.create({ transpose_semitones: 1.5 }),
      ).toThrow(EntityValidationError);
    });

    it("rejeita complexidade desconhecida", () => {
      expect(() =>
        ChordSheetViewSettings.create({
          chord_complexity: "impossível" as never,
        }),
      ).toThrow(EntityValidationError);
    });

    it("rejeita instrumento desconhecido", () => {
      expect(() =>
        ChordSheetViewSettings.create({ instrument: "gaita" as never }),
      ).toThrow(EntityValidationError);
    });

    it("rejeita scroll_speed fora da faixa", () => {
      expect(() => ChordSheetViewSettings.create({ scroll_speed: 5 })).toThrow(
        EntityValidationError,
      );
    });

    it("aceita os extremos válidos", () => {
      expect(() =>
        ChordSheetViewSettings.create({
          transpose_semitones: MAX_TRANSPOSE_SEMITONES,
          capo_fret: MAX_CAPO_FRET,
        }),
      ).not.toThrow();
    });
  });

  describe("fromJSON — leitura tolerante do Json persistido", () => {
    it("faz round-trip de uma configuração válida", () => {
      const original = ChordSheetViewSettings.create({
        transpose_semitones: -2,
        capo_fret: 4,
        chord_complexity: "simple",
        instrument: "cavaquinho",
        left_handed: true,
        preferred_accidental: "flat",
        scroll_speed: 1.5,
      });
      const restored = ChordSheetViewSettings.fromJSON(original.toJSON());

      expect(restored.toJSON()).toEqual(original.toJSON());
    });

    it.each([
      ["null", null],
      ["undefined", undefined],
      ["array", []],
      ["string", "banana"],
    ])("cai no default para %s", (_label, raw) => {
      expect(ChordSheetViewSettings.fromJSON(raw).toJSON()).toEqual(
        ChordSheetViewSettings.default().toJSON(),
      );
    });

    it("clampa valores fora da faixa em vez de lançar", () => {
      const view = ChordSheetViewSettings.fromJSON({
        transpose_semitones: 99,
        capo_fret: -5,
      });

      expect(view.transpose_semitones).toBe(MAX_TRANSPOSE_SEMITONES);
      expect(view.capo_fret).toBe(0);
    });

    it("arredonda semitons e casas fracionários vindos do banco", () => {
      const view = ChordSheetViewSettings.fromJSON({
        transpose_semitones: 2.4,
        capo_fret: 3.6,
      });

      expect(view.transpose_semitones).toBe(2);
      expect(view.capo_fret).toBe(4);
      expect(Number.isInteger(view.effectiveDisplaySemitones())).toBe(true);
    });

    it("ignora campos desconhecidos e usa default nos inválidos", () => {
      const view = ChordSheetViewSettings.fromJSON({
        chord_complexity: "turbo",
        instrument: "gaita",
        left_handed: "sim",
        campo_inexistente: 123,
      });

      expect(view.chord_complexity).toBe("full");
      expect(view.instrument).toBe("guitar");
      expect(view.left_handed).toBe(false);
    });
  });
});
