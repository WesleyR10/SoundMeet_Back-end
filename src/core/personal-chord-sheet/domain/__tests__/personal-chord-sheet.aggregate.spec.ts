import { randomUUID } from "crypto";

import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import {
  MAX_EDITS_PER_SHEET,
  MAX_NOTES_LENGTH,
  PersonalChordSheet,
  PersonalChordSheetId,
} from "../personal-chord-sheet.aggregate";
import { ChordEdit } from "../value-objects/chord-edit.vo";
import { ChordSheetViewSettings } from "../value-objects/chord-sheet-view-settings.vo";

const FINGERPRINT = "a".repeat(64);
const OTHER_FINGERPRINT = "b".repeat(64);

const validCommand = () => ({
  music_library_id: randomUUID(),
  musician_id: randomUUID(),
  base_fingerprint: FINGERPRINT,
  base_pipeline_version: 1,
});

const anEdit = (at_ms = 1000) =>
  ChordEdit.replaceChord({ at_ms, from: "Am", to: "Am7" });

describe("PersonalChordSheet Aggregate", () => {
  describe("create", () => {
    it("cria com os defaults corretos", () => {
      const sheet = PersonalChordSheet.create(validCommand());

      expect(sheet.personal_chord_sheet_id).toBeInstanceOf(
        PersonalChordSheetId,
      );
      expect(sheet.edits).toEqual([]);
      expect(sheet.notes).toBeNull();
      expect(sheet.share_scope).toBe("private");
      expect(sheet.shared_at).toBeNull();
      expect(sheet.reconcile_status).toBe("clean");
      expect(sheet.base_version).toBe(0);
      expect(sheet.base_pipeline_version).toBe(1);
      expect(sheet.view.toJSON()).toEqual(
        ChordSheetViewSettings.default().toJSON(),
      );
    });

    it("nasce privado — compartilhar é sempre ato explícito", () => {
      expect(PersonalChordSheet.create(validCommand()).is_shared).toBe(false);
    });

    it("expõe entity_id como o id do agregado", () => {
      const sheet = PersonalChordSheet.create(validCommand());
      expect(sheet.entity_id).toBe(sheet.personal_chord_sheet_id);
    });

    it.each([
      ["musician_id vazio", { musician_id: "" }],
      ["music_library_id vazio", { music_library_id: "" }],
      ["fingerprint que não é sha256", { base_fingerprint: "banana" }],
      ["fingerprint curto demais", { base_fingerprint: "abc123" }],
      ["fingerprint com maiúsculas", { base_fingerprint: "A".repeat(64) }],
    ])("lança EntityValidationError com %s", (_label, overrides) => {
      expect(() =>
        PersonalChordSheet.create({ ...validCommand(), ...overrides }),
      ).toThrow(EntityValidationError);
    });
  });

  describe("edições", () => {
    it("addEdit acrescenta e avança updated_at", () => {
      const sheet = PersonalChordSheet.fake().aPersonalChordSheet().build();
      const antes = sheet.updated_at;

      jest.spyOn(global.Date, "now");
      sheet.addEdit(anEdit());

      expect(sheet.edits).toHaveLength(1);
      expect(sheet.updated_at.getTime()).toBeGreaterThanOrEqual(
        antes.getTime(),
      );
    });

    it("addEdits acrescenta um lote", () => {
      const sheet = PersonalChordSheet.fake().aPersonalChordSheet().build();
      sheet.addEdits([anEdit(1000), anEdit(2000), anEdit(3000)]);
      expect(sheet.edits).toHaveLength(3);
    });

    it("removeEdit remove pelo id", () => {
      const edit = anEdit();
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withEdits([edit, anEdit(2000)])
        .build();

      sheet.removeEdit(edit.edit_id);

      expect(sheet.edits).toHaveLength(1);
      expect(sheet.edits.map((e) => e.edit_id)).not.toContain(edit.edit_id);
    });

    it("removeEdit com id inexistente lança EntityValidationError", () => {
      const sheet = PersonalChordSheet.fake().aPersonalChordSheet().build();
      expect(() => sheet.removeEdit(randomUUID())).toThrow(
        EntityValidationError,
      );
    });

    it("replaceEdits troca a lista inteira", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withOneEdit()
        .build();

      sheet.replaceEdits([anEdit(5000)]);

      expect(sheet.edits).toHaveLength(1);
      expect(sheet.edits[0].at_ms).toBe(5000);
    });

    it("clearEdits esvazia", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withOneEdit()
        .build();

      sheet.clearEdits();
      expect(sheet.edits).toEqual([]);
    });

    it("não guarda referência do array recebido no construtor", () => {
      const edits = [anEdit()];
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withEdits(edits)
        .build();

      edits.push(anEdit(9999));

      expect(sheet.edits).toHaveLength(1);
    });

    describe("limite de edições", () => {
      const cheio = () =>
        PersonalChordSheet.fake()
          .aPersonalChordSheet()
          .withEdits(
            Array.from({ length: MAX_EDITS_PER_SHEET }, (_, i) =>
              anEdit(i * 10),
            ),
          )
          .build();

      it("addEdit rejeita além do limite", () => {
        expect(() => cheio().addEdit(anEdit(999999))).toThrow(
          EntityValidationError,
        );
      });

      it("addEdits rejeita quando o lote estoura o limite", () => {
        const sheet = PersonalChordSheet.fake()
          .aPersonalChordSheet()
          .withEdits([anEdit()])
          .build();

        expect(() =>
          sheet.addEdits(
            Array.from({ length: MAX_EDITS_PER_SHEET }, (_, i) => anEdit(i)),
          ),
        ).toThrow(EntityValidationError);
      });

      it("replaceEdits rejeita lista acima do limite", () => {
        const sheet = PersonalChordSheet.fake().aPersonalChordSheet().build();
        expect(() =>
          sheet.replaceEdits(
            Array.from({ length: MAX_EDITS_PER_SHEET + 1 }, (_, i) =>
              anEdit(i),
            ),
          ),
        ).toThrow(EntityValidationError);
      });

      it("aceita exatamente o limite", () => {
        expect(() => cheio()).not.toThrow();
      });
    });
  });

  describe("view e notas", () => {
    it("changeView troca os parâmetros de visualização", () => {
      const sheet = PersonalChordSheet.fake().aPersonalChordSheet().build();
      sheet.changeView(
        ChordSheetViewSettings.create({ transpose_semitones: 2, capo_fret: 2 }),
      );

      expect(sheet.view.transpose_semitones).toBe(2);
      expect(sheet.view.effectiveDisplaySemitones()).toBe(0);
    });

    it("changeNotes grava e apara espaços", () => {
      const sheet = PersonalChordSheet.fake().aPersonalChordSheet().build();
      sheet.changeNotes("  afinar meio tom abaixo  ");
      expect(sheet.notes).toBe("afinar meio tom abaixo");
    });

    it("changeNotes com string vazia normaliza para null", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withNotes("algo")
        .build();

      sheet.changeNotes("   ");
      expect(sheet.notes).toBeNull();
    });

    it("changeNotes aceita null", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withNotes("algo")
        .build();

      sheet.changeNotes(null);
      expect(sheet.notes).toBeNull();
    });

    it("changeNotes rejeita acima do limite", () => {
      const sheet = PersonalChordSheet.fake().aPersonalChordSheet().build();
      expect(() => sheet.changeNotes("a".repeat(MAX_NOTES_LENGTH + 1))).toThrow(
        EntityValidationError,
      );
    });
  });

  describe("compartilhamento", () => {
    it("share('band') marca escopo e data", () => {
      const sheet = PersonalChordSheet.fake().aPersonalChordSheet().build();
      sheet.share("band");

      expect(sheet.share_scope).toBe("band");
      expect(sheet.shared_at).toBeInstanceOf(Date);
      expect(sheet.is_shared).toBe(true);
    });

    it("share('community') marca escopo e data", () => {
      const sheet = PersonalChordSheet.fake().aPersonalChordSheet().build();
      sheet.share("community");

      expect(sheet.share_scope).toBe("community");
      expect(sheet.is_shared).toBe(true);
    });

    it("unshare volta para privado e limpa a data", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withShareScope("community")
        .build();

      sheet.unshare();

      expect(sheet.share_scope).toBe("private");
      expect(sheet.shared_at).toBeNull();
      expect(sheet.is_shared).toBe(false);
    });

    it("rejeita escopo inválido", () => {
      const sheet = PersonalChordSheet.fake().aPersonalChordSheet().build();
      expect(() => sheet.share("private" as never)).toThrow(
        EntityValidationError,
      );
    });

    it("is_shared é derivado do escopo, não um campo próprio", () => {
      const sheet = PersonalChordSheet.fake().aPersonalChordSheet().build();
      expect(sheet.is_shared).toBe(false);
      sheet.share("band");
      expect(sheet.is_shared).toBe(true);
    });
  });

  describe("reconciliação", () => {
    it("matchesBase true quando fingerprint e pipeline batem", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withBaseFingerprint(FINGERPRINT)
        .withBasePipelineVersion(1)
        .build();

      expect(sheet.matchesBase(FINGERPRINT, 1)).toBe(true);
    });

    it("matchesBase false quando a IA re-analisou (fingerprint mudou)", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withBaseFingerprint(FINGERPRINT)
        .build();

      expect(sheet.matchesBase(OTHER_FINGERPRINT, 1)).toBe(false);
    });

    it("matchesBase false quando só o nosso normalizador mudou", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withBaseFingerprint(FINGERPRINT)
        .withBasePipelineVersion(1)
        .build();

      expect(sheet.matchesBase(FINGERPRINT, 2)).toBe(false);
    });

    it("markBaseUpdated sinaliza pendência", () => {
      const sheet = PersonalChordSheet.fake().aPersonalChordSheet().build();
      sheet.markBaseUpdated();
      expect(sheet.reconcile_status).toBe("base_updated");
    });

    it("markBaseUpdated é idempotente e não avança updated_at à toa", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withReconcileStatus("base_updated")
        .withUpdatedAt(new Date("2020-01-01"))
        .build();

      sheet.markBaseUpdated();

      expect(sheet.updated_at).toEqual(new Date("2020-01-01"));
    });

    it("markReconciled reancora no base novo e limpa a pendência", () => {
      const sobrevivente = anEdit(2000);
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withEdits([anEdit(1000), sobrevivente])
        .withBaseFingerprint(FINGERPRINT)
        .withReconcileStatus("base_updated")
        .build();

      sheet.markReconciled({
        kept_edits: [sobrevivente],
        base_fingerprint: OTHER_FINGERPRINT,
        base_pipeline_version: 2,
      });

      expect(sheet.edits).toHaveLength(1);
      expect(sheet.edits[0].edit_id).toBe(sobrevivente.edit_id);
      expect(sheet.base_fingerprint).toBe(OTHER_FINGERPRINT);
      expect(sheet.base_pipeline_version).toBe(2);
      expect(sheet.reconcile_status).toBe("clean");
      expect(sheet.matchesBase(OTHER_FINGERPRINT, 2)).toBe(true);
    });

    it("markReconciled preserva base_version quando não informado", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withBaseVersion(7)
        .build();

      sheet.markReconciled({
        kept_edits: [],
        base_fingerprint: OTHER_FINGERPRINT,
        base_pipeline_version: 1,
      });

      expect(sheet.base_version).toBe(7);
    });
  });

  /**
   * O validator usa literais em vez de importar as constantes do agregado (para
   * não fechar ciclo de import). Estes testes são o que impede os dois lados de
   * divergirem em silêncio.
   */
  describe("validator alinhado com as constantes do agregado", () => {
    it("rejeita notes exatamente 1 caractere acima de MAX_NOTES_LENGTH", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withNotes("a".repeat(MAX_NOTES_LENGTH + 1))
        .build();

      sheet.validate();
      expect(sheet.notification.hasErrors()).toBe(true);
    });

    it("aceita notes exatamente no limite", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withNotes("a".repeat(MAX_NOTES_LENGTH))
        .build();

      sheet.validate();
      expect(sheet.notification.hasErrors()).toBe(false);
    });

    it.each(["private", "band", "community"] as const)(
      "aceita o escopo %s",
      (scope) => {
        const sheet = PersonalChordSheet.fake()
          .aPersonalChordSheet()
          .withShareScope(scope)
          .build();

        sheet.validate();
        expect(sheet.notification.hasErrors()).toBe(false);
      },
    );

    it("rejeita escopo fora da lista", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withShareScope("mundial" as never)
        .build();

      sheet.validate();
      expect(sheet.notification.hasErrors()).toBe(true);
    });
  });

  describe("toJSON", () => {
    it("serializa o id como string e expõe is_shared derivado", () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withShareScope("community")
        .withOneEdit()
        .build();

      const json = sheet.toJSON();

      expect(json.personal_chord_sheet_id).toBe(
        sheet.personal_chord_sheet_id.id,
      );
      expect(json.is_shared).toBe(true);
      expect(json.edits).toHaveLength(1);
      expect(json.view).toEqual(sheet.view.toJSON());
    });
  });

  describe("fake builder", () => {
    it("PersonalChordSheet.fake() expõe o builder", () => {
      expect(PersonalChordSheet.fake()).toBe(
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require("../personal-chord-sheet-fake.builder")
          .PersonalChordSheetFakeBuilder,
      );
    });

    it("thePersonalChordSheets constrói vários independentes", () => {
      const sheets = PersonalChordSheet.fake()
        .thePersonalChordSheets(3)
        .map((b) => b.build());

      expect(sheets).toHaveLength(3);
      expect(
        new Set(sheets.map((s) => s.personal_chord_sheet_id.id)).size,
      ).toBe(3);
    });
  });
});
