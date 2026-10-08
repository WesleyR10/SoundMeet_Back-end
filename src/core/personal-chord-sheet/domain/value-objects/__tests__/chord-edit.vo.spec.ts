import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  ChordEdit,
  MAX_ANNOTATION_LENGTH,
  MAX_CHORD_SYMBOL_LENGTH,
  MAX_SECTION_LABEL_LENGTH,
} from "../chord-edit.vo";

describe("ChordEdit Value Object", () => {
  describe("factories", () => {
    it("replaceChord guarda from e to", () => {
      const edit = ChordEdit.replaceChord({
        at_ms: 12340,
        from: "Am",
        to: "Am7",
      });

      expect(edit.type).toBe("replace_chord");
      expect(edit.at_ms).toBe(12340);
      expect(edit.from).toBe("Am");
      expect(edit.to).toBe("Am7");
      expect(edit.edit_id).toEqual(expect.any(String));
      expect(edit.created_at).toBeInstanceOf(Date);
    });

    it("insertChord guarda o símbolo", () => {
      const edit = ChordEdit.insertChord({ at_ms: 45120, symbol: "F/A" });

      expect(edit.type).toBe("insert_chord");
      expect(edit.symbol).toBe("F/A");
      expect(edit.from).toBeNull();
    });

    it("deleteChord guarda o símbolo esperado em from", () => {
      const edit = ChordEdit.deleteChord({ at_ms: 900, from: "G" });

      expect(edit.type).toBe("delete_chord");
      expect(edit.from).toBe("G");
      expect(edit.expectedSymbol).toBe("G");
    });

    it("shiftChord guarda origem e destino", () => {
      const edit = ChordEdit.shiftChord({
        at_ms: 1000,
        to_ms: 1500,
        symbol: "C",
      });

      expect(edit.type).toBe("shift_chord");
      expect(edit.at_ms).toBe(1000);
      expect(edit.to_ms).toBe(1500);
    });

    it("relabelSection usa at_ms como início da seção", () => {
      const edit = ChordEdit.relabelSection({
        section_start_ms: 30000,
        label: "Refrão",
      });

      expect(edit.type).toBe("relabel_section");
      expect(edit.at_ms).toBe(30000);
      expect(edit.label).toBe("Refrão");
    });

    it("annotate guarda o texto livre", () => {
      const edit = ChordEdit.annotate({
        at_ms: 60000,
        text: "solo entra aqui",
      });

      expect(edit.type).toBe("annotate");
      expect(edit.text).toBe("solo entra aqui");
    });

    it("arredonda timestamps fracionários", () => {
      expect(ChordEdit.insertChord({ at_ms: 1234.6, symbol: "C" }).at_ms).toBe(
        1235,
      );
    });

    it("remove espaços em volta dos símbolos", () => {
      const edit = ChordEdit.replaceChord({
        at_ms: 0,
        from: "  Am  ",
        to: " Am7 ",
      });
      expect(edit.from).toBe("Am");
      expect(edit.to).toBe("Am7");
    });

    it("gera edit_id único por edit", () => {
      const a = ChordEdit.insertChord({ at_ms: 0, symbol: "C" });
      const b = ChordEdit.insertChord({ at_ms: 0, symbol: "C" });
      expect(a.edit_id).not.toBe(b.edit_id);
    });
  });

  describe("validação", () => {
    it.each([
      [
        "at_ms negativo",
        () => ChordEdit.insertChord({ at_ms: -1, symbol: "C" }),
      ],
      ["at_ms NaN", () => ChordEdit.insertChord({ at_ms: NaN, symbol: "C" })],
      [
        "at_ms infinito",
        () => ChordEdit.insertChord({ at_ms: Infinity, symbol: "C" }),
      ],
      [
        "símbolo vazio",
        () => ChordEdit.insertChord({ at_ms: 0, symbol: "  " }),
      ],
      [
        "from vazio no replace",
        () => ChordEdit.replaceChord({ at_ms: 0, from: "", to: "C" }),
      ],
      [
        "to vazio no replace",
        () => ChordEdit.replaceChord({ at_ms: 0, from: "C", to: "" }),
      ],
      [
        "label vazio",
        () => ChordEdit.relabelSection({ section_start_ms: 0, label: " " }),
      ],
      ["texto vazio", () => ChordEdit.annotate({ at_ms: 0, text: "" })],
      [
        "to_ms inválido no shift",
        () => ChordEdit.shiftChord({ at_ms: 0, to_ms: -5, symbol: "C" }),
      ],
    ])("lança EntityValidationError para %s", (_label, act) => {
      expect(act).toThrow(EntityValidationError);
    });

    it("rejeita símbolo acima do limite de tamanho", () => {
      expect(() =>
        ChordEdit.insertChord({
          at_ms: 0,
          symbol: "C".repeat(MAX_CHORD_SYMBOL_LENGTH + 1),
        }),
      ).toThrow(EntityValidationError);
    });

    it("rejeita anotação acima do limite", () => {
      expect(() =>
        ChordEdit.annotate({
          at_ms: 0,
          text: "a".repeat(MAX_ANNOTATION_LENGTH + 1),
        }),
      ).toThrow(EntityValidationError);
    });

    it("rejeita rótulo de seção acima do limite", () => {
      expect(() =>
        ChordEdit.relabelSection({
          section_start_ms: 0,
          label: "a".repeat(MAX_SECTION_LABEL_LENGTH + 1),
        }),
      ).toThrow(EntityValidationError);
    });
  });

  describe("fromJSON — leitura tolerante do Json persistido", () => {
    it("reconstrói um edit válido", () => {
      const original = ChordEdit.replaceChord({
        at_ms: 12340,
        from: "Am",
        to: "Am7",
      });
      const restored = ChordEdit.fromJSON(JSON.parse(JSON.stringify(original)));

      expect(restored).not.toBeNull();
      expect(restored!.edit_id).toBe(original.edit_id);
      expect(restored!.type).toBe("replace_chord");
      expect(restored!.at_ms).toBe(12340);
      expect(restored!.from).toBe("Am");
      expect(restored!.to).toBe("Am7");
      expect(restored!.created_at.toISOString()).toBe(
        original.created_at.toISOString(),
      );
    });

    it.each([
      ["null", null],
      ["undefined", undefined],
      ["array", []],
      ["string", "banana"],
      ["número", 42],
      ["objeto vazio", {}],
      ["tipo desconhecido", { type: "explode_chord", at_ms: 0 }],
      ["at_ms ausente", { type: "insert_chord" }],
      ["at_ms não numérico", { type: "insert_chord", at_ms: "1000" }],
    ])("devolve null (não lança) para %s", (_label, raw) => {
      expect(() => ChordEdit.fromJSON(raw)).not.toThrow();
      expect(ChordEdit.fromJSON(raw)).toBeNull();
    });

    it("gera edit_id novo quando o persistido está faltando", () => {
      const restored = ChordEdit.fromJSON({
        type: "insert_chord",
        at_ms: 10,
        symbol: "C",
      });
      expect(restored!.edit_id).toEqual(expect.any(String));
      expect(restored!.edit_id.length).toBeGreaterThan(0);
    });

    it("arredonda timestamps fracionários vindos do banco", () => {
      const restored = ChordEdit.fromJSON({
        type: "shift_chord",
        at_ms: 1234.6,
        to_ms: 5678.2,
        symbol: "C",
      })!;

      expect(restored.at_ms).toBe(1235);
      expect(restored.to_ms).toBe(5678);
    });

    it("usa epoch quando created_at é inválido, em vez de quebrar a ordenação", () => {
      const restored = ChordEdit.fromJSON({
        type: "insert_chord",
        at_ms: 10,
        symbol: "C",
        created_at: "não é data",
      });
      expect(restored!.created_at.getTime()).toBe(0);
    });
  });

  describe("orderingRank", () => {
    it("garante delete antes de replace antes de insert", () => {
      const del = ChordEdit.deleteChord({ at_ms: 0, from: "C" });
      const rep = ChordEdit.replaceChord({ at_ms: 0, from: "C", to: "C7" });
      const ins = ChordEdit.insertChord({ at_ms: 0, symbol: "C" });

      expect(del.orderingRank).toBeLessThan(rep.orderingRank);
      expect(rep.orderingRank).toBeLessThan(ins.orderingRank);
    });
  });

  describe("toJSON", () => {
    it("serializa created_at como ISO string", () => {
      const json = ChordEdit.annotate({ at_ms: 5, text: "oi" }).toJSON();
      expect(json.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("faz round-trip completo por JSON", () => {
      const original = ChordEdit.shiftChord({
        at_ms: 100,
        to_ms: 200,
        symbol: "F#m",
      });
      const restored = ChordEdit.fromJSON(
        JSON.parse(JSON.stringify(original)),
      )!;
      expect(restored.toJSON()).toEqual(original.toJSON());
    });
  });
});
