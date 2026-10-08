import { PersonalChordSheetFakeBuilder } from "../../../../domain/personal-chord-sheet-fake.builder";
import { ChordSheetViewSettings } from "../../../../domain/value-objects/chord-sheet-view-settings.vo";
import { PersonalChordSheetInMemoryRepository } from "../../../../infra/db/in-memory/personal-chord-sheet-in-memory.repository";
import { ApplyChordEditsUseCase } from "../apply-chord-edits.use-case";

/*
 * 🔴 O músico edita o que VÊ, e o overlay guarda no tom ORIGINAL. Sem a
 * conversão, com a cifra transposta o "corrigir" virava `symbol_mismatch` e o
 * acorde escolhido era transposto duas vezes na exibição.
 */
describe("ApplyChordEditsUseCase — tom da tela → tom original", () => {
  const MUSICIAN = "22222222-2222-2222-2222-222222222222";

  async function setup(view: ChordSheetViewSettings) {
    const repo = new PersonalChordSheetInMemoryRepository();
    const sheet = PersonalChordSheetFakeBuilder.aPersonalChordSheet()
      .withMusicianId(MUSICIAN)
      .withEdits([])
      .withView(view)
      .build();
    await repo.insert(sheet);
    return {
      repo,
      id: sheet.personal_chord_sheet_id.id,
      useCase: new ApplyChordEditsUseCase(repo),
    };
  }

  it("transposição +2: corrigir A→Bm na tela grava G→Am", async () => {
    const { useCase, id } = await setup(
      ChordSheetViewSettings.create({ transpose_semitones: 2 }),
    );

    const out = await useCase.execute({
      personal_chord_sheet_id: id,
      musician_id: MUSICIAN,
      edits: [{ type: "replace_chord", at_ms: 1000, from: "A", to: "Bm" }],
    });

    expect(out.edits[0]).toMatchObject({ from: "G", to: "Am" });
  });

  it("capotraste 2 (formas 2 abaixo): inserir C na tela grava D", async () => {
    const { useCase, id } = await setup(
      ChordSheetViewSettings.create({ capo_fret: 2 }),
    );

    const out = await useCase.execute({
      personal_chord_sheet_id: id,
      musician_id: MUSICIAN,
      edits: [{ type: "insert_chord", at_ms: 1000, symbol: "C" }],
    });

    expect(out.edits[0]).toMatchObject({ symbol: "D" });
  });

  it("sem deslocamento é identidade — edições antigas não mudam de sentido", async () => {
    const { useCase, id } = await setup(ChordSheetViewSettings.create({}));

    const out = await useCase.execute({
      personal_chord_sheet_id: id,
      musician_id: MUSICIAN,
      edits: [{ type: "replace_chord", at_ms: 1000, from: "C7M", to: "Am" }],
    });

    expect(out.edits[0]).toMatchObject({ from: "C7M", to: "Am" });
  });
});
