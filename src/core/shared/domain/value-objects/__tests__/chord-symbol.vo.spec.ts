import {
  type ChordAccidentalPreference,
  ChordSymbol,
  InvalidChordSymbolError,
} from "../chord-symbol.vo";

describe("ChordSymbol Value Object", () => {
  describe("parse — notação padrão/brasileira", () => {
    const cases: Array<[string, string]> = [
      ["C", "C"],
      ["Am", "Am"],
      ["Am7", "Am7"],
      ["C7", "C7"],
      ["Cmaj7", "Cmaj7"],
      ["C7M", "Cmaj7"], // notação Cifra Club normaliza para maj7
      ["CM7", "Cmaj7"],
      ["Bb", "Bb"],
      ["F#sus4", "F#sus4"],
      ["Dsus2", "Dsus2"],
      ["Ddim", "Ddim"],
      ["Ddim7", "Ddim7"],
      ["Eaug", "Eaug"],
      ["E+", "Eaug"],
      ["E5+", "Eaug"],
      ["G/B", "G/B"],
      ["C#m7(b5)/G#", "C#m7(b5)/G#"],
      ["C#m7b5", "C#m7(b5)"],
      ["Bø", "Bm7(b5)"],
      ["C6", "C6"],
      ["Am6", "Am6"],
      ["C9", "C9"],
      ["Cmaj9", "Cmaj9"],
      ["Am9", "Am9"],
      ["C5", "C5"],
      ["Cadd9", "Cadd9"],
      ["Cm(maj7)", "Cm(maj7)"],
      ["C7(b9)", "C7(b9)"],
    ];

    it.each(cases)("parseia %s → %s", (input, expected) => {
      const chord = ChordSymbol.parse(input);
      expect(chord).not.toBeNull();
      expect(chord!.toString()).toBe(expected);
    });

    it("distingue maiúscula de minúscula em m/M — CM é maior, Cm é menor", () => {
      expect(ChordSymbol.parse("CM")!.triad).toBe("maj");
      expect(ChordSymbol.parse("Cm")!.triad).toBe("min");
      expect(ChordSymbol.parse("CM")!.toString()).toBe("C");
      expect(ChordSymbol.parse("Cm")!.toString()).toBe("Cm");
    });

    it("aceita raiz em minúscula", () => {
      expect(ChordSymbol.parse("am")!.toString()).toBe("Am");
    });

    it("preserva a grafia original quando não há transposição", () => {
      expect(ChordSymbol.parse("Db")!.toString()).toBe("Db");
      expect(ChordSymbol.parse("C#")!.toString()).toBe("C#");
    });

    it("aceita acidentes unicode ♯ e ♭", () => {
      expect(ChordSymbol.parse("C♯m")!.root_pc).toBe(1);
      expect(ChordSymbol.parse("D♭")!.root_pc).toBe(1);
    });

    /**
     * meta.key pode chegar por extenso. Sem estas formas a tonalidade não
     * parseia e a transposição a deixa para trás, sem erro nenhum.
     */
    it.each<[string, string, string]>([
      ["C major", "C", "maj"],
      ["A minor", "Am", "min"],
      ["Bb minor", "Bbm", "min"],
      ["Cmin", "Cm", "min"],
      ["Cmin7", "Cm7", "min"],
      ["F# major", "F#", "maj"],
    ])("parseia tonalidade por extenso: %s → %s", (input, expected, triad) => {
      const chord = ChordSymbol.parse(input);
      expect(chord).not.toBeNull();
      expect(chord!.toString()).toBe(expected);
      expect(chord!.triad).toBe(triad);
    });
  });

  describe("parse — formato colon do worker MIR/ChordFormer", () => {
    const cases: Array<[string, string]> = [
      ["C:maj", "C"],
      ["A:min", "Am"],
      ["A:min7", "Am7"],
      ["C:maj7", "Cmaj7"],
      ["G:7", "G7"],
      ["F#:min/C#", "F#m/C#"],
      ["Bb:maj7", "Bbmaj7"],
      ["B:hdim7", "Bm7(b5)"],
      ["C:dim7", "Cdim7"],
      ["D:sus4", "Dsus4"],
      ["E:min6", "Em6"],
      ["C:9", "C9"],
    ];

    it.each(cases)("parseia %s → %s", (input, expected) => {
      expect(ChordSymbol.parse(input)!.toString()).toBe(expected);
    });
  });

  describe("parse — no-chord e entradas inválidas", () => {
    it.each(["N", "N.C.", "NC", "no_chord", "NOCHORD", "X"])(
      "trata %s como no-chord (isNoChord true, parse null)",
      (value) => {
        expect(ChordSymbol.isNoChord(value)).toBe(true);
        expect(ChordSymbol.parse(value)).toBeNull();
      },
    );

    it.each(["", "   ", "H", "Zm7", "C:banana", "C%%%", "12345"])(
      "devolve null para entrada inválida: %s",
      (value) => {
        expect(ChordSymbol.parse(value)).toBeNull();
      },
    );

    it("parseOrThrow lança InvalidChordSymbolError", () => {
      expect(() => ChordSymbol.parseOrThrow("banana")).toThrow(
        InvalidChordSymbolError,
      );
    });
  });

  describe("transpose", () => {
    it("transpõe a fundamental e o baixo juntos", () => {
      const chord = ChordSymbol.parse("G/B")!.transpose(2, "sharp");
      expect(chord.toString()).toBe("A/C#");
    });

    it("respeita a preferência enarmônica", () => {
      const base = ChordSymbol.parse("C")!;
      expect(base.transpose(1, "sharp").toString()).toBe("C#");
      expect(base.transpose(1, "flat").toString()).toBe("Db");
    });

    it("preserva a qualidade completa do acorde", () => {
      const chord = ChordSymbol.parse("C#m7(b5)/G#")!.transpose(1, "flat");
      expect(chord.toString()).toBe("Dm7(b5)/A");
      expect(chord.triad).toBe("dim");
      expect(chord.seventh).toBe("dom7");
    });

    it("transpor por 0 devolve a mesma instância", () => {
      const chord = ChordSymbol.parse("Am7")!;
      expect(chord.transpose(0, "sharp")).toBe(chord);
    });

    it("dá a volta corretamente acima de B e abaixo de C", () => {
      expect(ChordSymbol.parse("B")!.transpose(1, "sharp").toString()).toBe(
        "C",
      );
      expect(ChordSymbol.parse("C")!.transpose(-1, "flat").toString()).toBe(
        "B",
      );
    });

    it("aceita saltos maiores que uma oitava", () => {
      expect(ChordSymbol.parse("C")!.transpose(14, "sharp").toString()).toBe(
        "D",
      );
      expect(ChordSymbol.parse("C")!.transpose(-14, "sharp").toString()).toBe(
        "A#",
      );
    });

    // A propriedade que garante que ninguém perde a cifra ao transpor e voltar.
    describe("round-trip: transpose(n) ∘ transpose(−n) === identidade", () => {
      const preferences: ChordAccidentalPreference[] = ["sharp", "flat"];
      const qualities = [
        "",
        "m",
        "7",
        "maj7",
        "m7",
        "dim",
        "aug",
        "sus4",
        "m7b5",
      ];

      it.each(preferences)(
        "para todas as 12 pitch classes (%s)",
        (preferred) => {
          for (let pc = 0; pc < 12; pc++) {
            const root = ChordSymbol.spellPitchClass(pc, preferred);
            for (const quality of qualities) {
              for (let n = -11; n <= 11; n++) {
                const original = ChordSymbol.parse(`${root}${quality}`)!;
                const roundTrip = original
                  .transpose(n, preferred)
                  .transpose(-n, preferred);

                expect(roundTrip.root_pc).toBe(original.root_pc);
                expect(roundTrip.triad).toBe(original.triad);
                expect(roundTrip.seventh).toBe(original.seventh);
                expect(roundTrip.toString()).toBe(original.toString());
              }
            }
          }
        },
      );
    });
  });

  describe("simplify", () => {
    it("full é identidade", () => {
      const chord = ChordSymbol.parse("C#m7(b5)/G#")!;
      expect(chord.simplify("full")).toBe(chord);
    });

    const simpleCases: Array<[string, string]> = [
      ["Cmaj9", "Cmaj7"],
      ["C13", "C7"],
      ["Am11", "Am7"],
      ["Cm7(b5)", "Cm7"],
      ["C7(b9)", "C7"],
      ["C6", "C6"],
      ["Cadd9", "C"],
      ["Am7", "Am7"],
      ["G/B", "G/B"],
    ];

    it.each(simpleCases)("simple: %s → %s", (input, expected) => {
      expect(ChordSymbol.parse(input)!.simplify("simple").toString()).toBe(
        expected,
      );
    });

    const basicCases: Array<[string, string]> = [
      ["Cmaj9", "C"],
      ["Am7", "Am"],
      ["Cm7(b5)", "Cdim"],
      ["Cdim7", "Cdim"],
      ["Csus4", "C"],
      ["Dsus2", "D"],
      ["C5", "C"],
      ["Caug", "Caug"],
      ["G/B", "G"],
      ["C#m7(b5)/G#", "C#dim"],
    ];

    it.each(basicCases)("basic: %s → %s", (input, expected) => {
      expect(ChordSymbol.parse(input)!.simplify("basic").toString()).toBe(
        expected,
      );
    });

    it("basic descarta o baixo invertido", () => {
      expect(ChordSymbol.parse("G/B")!.simplify("basic").bass_pc).toBeNull();
    });
  });

  describe("equalsEnharmonically", () => {
    it("considera C#m7 e Dbm7 o mesmo acorde", () => {
      const a = ChordSymbol.parse("C#m7")!;
      const b = ChordSymbol.parse("Dbm7")!;
      expect(a.equalsEnharmonically(b)).toBe(true);
      expect(a.toString()).not.toBe(b.toString());
    });

    it("considera o formato colon e o padrão equivalentes", () => {
      expect(
        ChordSymbol.parse("A:min7")!.equalsEnharmonically(
          ChordSymbol.parse("Am7")!,
        ),
      ).toBe(true);
    });

    it("distingue qualidades diferentes na mesma fundamental", () => {
      expect(
        ChordSymbol.parse("Am")!.equalsEnharmonically(
          ChordSymbol.parse("Am7")!,
        ),
      ).toBe(false);
    });

    it("distingue baixos diferentes", () => {
      expect(
        ChordSymbol.parse("G/B")!.equalsEnharmonically(ChordSymbol.parse("G")!),
      ).toBe(false);
    });

    it("devolve false para null", () => {
      expect(ChordSymbol.parse("C")!.equalsEnharmonically(null)).toBe(false);
    });
  });

  describe("pitchClasses", () => {
    it("monta a tríade maior", () => {
      expect(ChordSymbol.parse("C")!.pitchClasses).toEqual([0, 4, 7]);
    });

    it("monta a tríade menor", () => {
      expect(ChordSymbol.parse("Am")!.pitchClasses).toEqual([0, 4, 9]);
    });

    it("inclui a sétima menor", () => {
      expect(ChordSymbol.parse("C7")!.pitchClasses).toEqual([0, 4, 7, 10]);
    });

    it("inclui a sétima maior", () => {
      expect(ChordSymbol.parse("Cmaj7")!.pitchClasses).toEqual([0, 4, 7, 11]);
    });

    it("monta o meio-diminuto", () => {
      expect(ChordSymbol.parse("Cm7(b5)")!.pitchClasses).toEqual([0, 3, 6, 10]);
    });

    it("inclui o baixo invertido", () => {
      expect(ChordSymbol.parse("G/B")!.pitchClasses).toContain(11);
    });

    it("power chord tem só fundamental e quinta", () => {
      expect(ChordSymbol.parse("C5")!.pitchClasses).toEqual([0, 7]);
    });
  });

  describe("imutabilidade", () => {
    it("transpose não muta a instância original", () => {
      const chord = ChordSymbol.parse("Am7")!;
      const before = chord.toString();
      chord.transpose(5, "sharp");
      expect(chord.toString()).toBe(before);
    });

    it("simplify não muta a instância original", () => {
      const chord = ChordSymbol.parse("Cmaj9")!;
      const before = chord.toString();
      chord.simplify("basic");
      expect(chord.toString()).toBe(before);
    });

    it("toJSON devolve cópias dos arrays", () => {
      const chord = ChordSymbol.parse("C7(b9)")!;
      const json = chord.toJSON();
      json.alterations.push("#11");
      expect(chord.alterations).toEqual(["b9"]);
    });
  });

  describe("helpers estáticos", () => {
    it("spellPitchClass respeita a preferência", () => {
      expect(ChordSymbol.spellPitchClass(1, "sharp")).toBe("C#");
      expect(ChordSymbol.spellPitchClass(1, "flat")).toBe("Db");
      expect(ChordSymbol.spellPitchClass(0, "flat")).toBe("C");
    });

    it("spellPitchClass normaliza índices fora da faixa", () => {
      expect(ChordSymbol.spellPitchClass(12, "sharp")).toBe("C");
      expect(ChordSymbol.spellPitchClass(-1, "sharp")).toBe("B");
    });

    it("pitchClassOf resolve notas isoladas", () => {
      expect(ChordSymbol.pitchClassOf("C")).toBe(0);
      expect(ChordSymbol.pitchClassOf("Bb")).toBe(10);
      expect(ChordSymbol.pitchClassOf("banana")).toBeNull();
    });
  });
});
