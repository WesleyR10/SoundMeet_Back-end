import { ForbiddenException } from "@nestjs/common";

import { ConflictError } from "../../../../shared/domain/errors/conflict.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import type { ChordSheetOutput } from "../../../../synced-lyrics/application/use-cases/common/chord-sheet-output";
import { PersonalChordSheet } from "../../../domain/personal-chord-sheet.aggregate";
import { ChordEdit } from "../../../domain/value-objects/chord-edit.vo";
import { ChordSheetViewSettings } from "../../../domain/value-objects/chord-sheet-view-settings.vo";
import { PersonalChordSheetInMemoryReadModel } from "../../../infra/db/in-memory/personal-chord-sheet-in-memory.read-model";
import { PersonalChordSheetInMemoryRepository } from "../../../infra/db/in-memory/personal-chord-sheet-in-memory.repository";
import {
  CHORD_SHEET_FINGERPRINT_VERSION,
  computeChordSheetBaseFingerprint,
} from "../../services/chord-sheet-fingerprint";
import { ChordSheetOverlayApplier } from "../../services/chord-sheet-overlay-applier";
import { ApplyChordEditsUseCase } from "../apply-chord-edits/apply-chord-edits.use-case";
import { CheckPersonalChordSheetAccessUseCase } from "../check-personal-chord-sheet-access/check-personal-chord-sheet-access.use-case";
import { DeletePersonalChordSheetUseCase } from "../delete-personal-chord-sheet/delete-personal-chord-sheet.use-case";
import { ForkChordSheetUseCase } from "../fork-chord-sheet/fork-chord-sheet.use-case";
import { GetPersonalChordSheetUseCase } from "../get-personal-chord-sheet/get-personal-chord-sheet.use-case";
import { GetPersonalChordSheetViewUseCase } from "../get-personal-chord-sheet-view/get-personal-chord-sheet-view.use-case";
import { ImportCommunityChordSheetUseCase } from "../import-community-chord-sheet/import-community-chord-sheet.use-case";
import { ListCommunityChordSheetsUseCase } from "../list-community-chord-sheets/list-community-chord-sheets.use-case";
import { ListPersonalChordSheetsUseCase } from "../list-personal-chord-sheets/list-personal-chord-sheets.use-case";
import { RemoveChordEditUseCase } from "../remove-chord-edit/remove-chord-edit.use-case";
import { SharePersonalChordSheetUseCase } from "../share-personal-chord-sheet/share-personal-chord-sheet.use-case";
import { UnsharePersonalChordSheetUseCase } from "../unshare-personal-chord-sheet/unshare-personal-chord-sheet.use-case";
import { UpdatePersonalNotesUseCase } from "../update-personal-notes/update-personal-notes.use-case";
import { UpdateViewSettingsUseCase } from "../update-view-settings/update-view-settings.use-case";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const MUSIC = "33333333-3333-4333-8333-333333333333";
const OTHER_MUSIC = "44444444-4444-4444-8444-444444444444";

const baseSheet = (
  musician_id = OWNER,
  music_library_id = MUSIC,
  timeline = [
    { startMs: 0, endMs: 2000, symbol: "C" },
    { startMs: 2000, endMs: 4000, symbol: "Am" },
    { startMs: 4000, endMs: 6000, symbol: "F" },
  ],
): ChordSheetOutput => ({
  music_library_id,
  musician_id,
  title: "Música",
  artist: "Artista",
  lyrics: {
    normalized: {
      sections: [
        {
          startMs: 0,
          endMs: 6000,
          lines: [
            {
              tokens: [
                {
                  text: "uma",
                  kind: "word",
                  normalized: "uma",
                  startMs: 0,
                  endMs: 2000,
                },
                { text: " ", kind: "space", normalized: " " },
                {
                  text: "linha",
                  kind: "word",
                  normalized: "linha",
                  startMs: 2000,
                  endMs: 6000,
                },
              ],
            },
          ],
        },
      ],
    },
  },
  chords: { timeline },
  alignment: { anchors: {} },
  meta: {
    provider: "lrclib",
    pipelineVersion: 1,
    qualityFlags: [],
    bpm: 120,
    key: "C",
  },
  updated_at: new Date("2026-07-29T00:00:00.000Z"),
});

/** Stub do use-case base: só precisa devolver o artefato e barrar dono errado. */
class FakeGetChordSheet {
  constructor(private readonly sheets: ChordSheetOutput[]) {}

  execute = jest.fn(
    async (input: { musician_id: string; music_library_id: string }) => {
      const found = this.sheets.find(
        (s) =>
          s.musician_id === input.musician_id &&
          s.music_library_id === input.music_library_id,
      );
      if (!found) {
        throw new NotFoundError(input.music_library_id, PersonalChordSheet);
      }
      return found;
    },
  );
}

/**
 * PlanCheckService de teste. Por padrão libera tudo — o objetivo destes testes
 * é o comportamento do overlay e do ownership, não o gate de plano (coberto nos
 * testes do próprio PlanCheckService e no int-spec do módulo). Os construtores
 * `denying*` existem para provar que o gate é de fato chamado.
 */
function fakePlanCheck(
  overrides: Partial<{
    createChordSheet: () => Promise<void>;
    feature: () => Promise<void>;
  }> = {},
) {
  return {
    assertMusicianCanCreatePersonalChordSheet:
      overrides.createChordSheet ?? (async () => {}),
    assertMusicianFeature: overrides.feature ?? (async () => {}),
  } as never;
}

describe("Use-cases de cifra pessoal", () => {
  let repo: PersonalChordSheetInMemoryRepository;
  let readModel: PersonalChordSheetInMemoryReadModel;
  let applier: ChordSheetOverlayApplier;

  beforeEach(() => {
    repo = new PersonalChordSheetInMemoryRepository();
    readModel = new PersonalChordSheetInMemoryReadModel(repo);
    applier = new ChordSheetOverlayApplier();
  });

  describe("ForkChordSheetUseCase", () => {
    it("cria o fork ancorado no fingerprint da análise vigente", async () => {
      const base = baseSheet();
      const useCase = new ForkChordSheetUseCase(
        repo,
        new FakeGetChordSheet([base]) as never,
        fakePlanCheck(),
      );

      const output = await useCase.execute({
        musician_id: OWNER,
        music_library_id: MUSIC,
      });

      expect(output.musician_id).toBe(OWNER);
      expect(output.edits).toEqual([]);
      expect(output.share_scope).toBe("private");
      expect(output.base_fingerprint).toBe(
        computeChordSheetBaseFingerprint(base.chords.timeline),
      );
      expect(output.base_pipeline_version).toBe(
        CHORD_SHEET_FINGERPRINT_VERSION,
      );
    });

    it("recusa fork duplicado da mesma música", async () => {
      const useCase = new ForkChordSheetUseCase(
        repo,
        new FakeGetChordSheet([baseSheet()]) as never,
        fakePlanCheck(),
      );
      await useCase.execute({ musician_id: OWNER, music_library_id: MUSIC });

      await expect(
        useCase.execute({ musician_id: OWNER, music_library_id: MUSIC }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("recusa fork de música que não é do músico", async () => {
      const useCase = new ForkChordSheetUseCase(
        repo,
        new FakeGetChordSheet([baseSheet(OTHER, MUSIC)]) as never,
        fakePlanCheck(),
      );

      await expect(
        useCase.execute({ musician_id: OWNER, music_library_id: MUSIC }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("GetPersonalChordSheetUseCase", () => {
    const seedWithNotes = async () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withMusicLibraryId(MUSIC)
        .withNotes("segurar o Am7 no refrão")
        .withShareScope("community")
        .build();
      await repo.insert(sheet);
      return sheet;
    };

    it("devolve o fork com as anotações quando quem lê é o dono", async () => {
      const sheet = await seedWithNotes();
      const useCase = new GetPersonalChordSheetUseCase(repo);

      const out = await useCase.execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        owner_musician_id: OWNER,
        requesting_musician_id: OWNER,
      });

      expect(out.personal_chord_sheet_id).toBe(
        sheet.personal_chord_sheet_id.id,
      );
      expect(out.notes).toBe("segurar o Am7 no refrão");
    });

    /**
     * Regressão: a rota do dono passava `is_owner: true` afirmado e o use-case
     * só fazia findById. O MusicianOwnershipGuard aprova
     * `/musicians/{eu}/personal-chord-sheets/{fork-de-outro}` — ele confere o
     * músico da URL contra o token, não de quem é o fork do path —, então o
     * atacante recebia 200 com as anotações privadas da vítima.
     */
    it("recusa o fork de outro músico mesmo com o id do atacante como dono", async () => {
      const sheet = await seedWithNotes();
      const useCase = new GetPersonalChordSheetUseCase(repo);

      await expect(
        useCase.execute({
          personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
          owner_musician_id: OTHER,
          requesting_musician_id: OTHER,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    /**
     * O contrato que sustenta a rota de comunidade: as correções de acorde são
     * públicas, o caderno pessoal do músico não.
     */
    it("redige as anotações quando quem lê NÃO é o dono", async () => {
      const sheet = await seedWithNotes();
      const useCase = new GetPersonalChordSheetUseCase(repo);

      const out = await useCase.execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        // O dono resolvido pelo CheckAccess; quem lê é outro músico.
        owner_musician_id: OWNER,
        requesting_musician_id: OTHER,
      });

      expect(out.notes).toBeNull();
      // o resto do fork continua visível — não é um 403 disfarçado
      expect(out.share_scope).toBe("community");
      expect(out.musician_id).toBe(OWNER);
    });

    it("lança NotFoundError quando o fork não existe", async () => {
      const useCase = new GetPersonalChordSheetUseCase(repo);

      await expect(
        useCase.execute({
          personal_chord_sheet_id: "55555555-5555-4555-8555-555555555555",
          owner_musician_id: OWNER,
          requesting_musician_id: OWNER,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("GetPersonalChordSheetViewUseCase", () => {
    const seed = async () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withMusicLibraryId(MUSIC)
        .withBaseFingerprint(
          computeChordSheetBaseFingerprint(baseSheet().chords.timeline),
        )
        .withEdits([
          ChordEdit.replaceChord({ at_ms: 2000, from: "Am", to: "Am7" }),
        ])
        .build();
      await repo.insert(sheet);
      return sheet;
    };

    it("devolve a cifra com as correções aplicadas", async () => {
      const sheet = await seed();
      const useCase = new GetPersonalChordSheetViewUseCase(
        repo,
        new FakeGetChordSheet([baseSheet()]) as never,
        applier,
      );

      const out = await useCase.execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        owner_musician_id: OWNER,
      });

      expect(out.sheet.chords.timeline.map((c) => c.symbol)).toEqual([
        "C",
        "Am7",
        "F",
      ]);
      expect(out.conflict_count).toBe(0);
      expect(out.base_changed).toBe(false);
      expect(out.reconcile_status).toBe("clean");
    });

    it("aplica view_override sem persistir nada", async () => {
      const sheet = await seed();
      const useCase = new GetPersonalChordSheetViewUseCase(
        repo,
        new FakeGetChordSheet([baseSheet()]) as never,
        applier,
      );

      const out = await useCase.execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        owner_musician_id: OWNER,
        view_override: { transpose_semitones: 2 },
      });

      expect(out.sheet.chords.timeline.map((c) => c.symbol)).toEqual([
        "D",
        "Bm7",
        "G",
      ]);

      const reloaded = await repo.findById(sheet.personal_chord_sheet_id);
      expect(reloaded!.view.transpose_semitones).toBe(0);
    });

    /** A leitura detecta que a IA mudou, mas NÃO reescreve o fork. */
    it("sinaliza base_changed sem persistir quando a IA re-analisou", async () => {
      const sheet = await seed();
      const reanalisado = baseSheet(OWNER, MUSIC, [
        { startMs: 0, endMs: 2000, symbol: "C" },
        { startMs: 2000, endMs: 4000, symbol: "Am7" },
        { startMs: 4000, endMs: 6000, symbol: "Fmaj7" },
      ]);

      const useCase = new GetPersonalChordSheetViewUseCase(
        repo,
        new FakeGetChordSheet([reanalisado]) as never,
        applier,
      );

      const out = await useCase.execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        owner_musician_id: OWNER,
      });

      expect(out.base_changed).toBe(true);
      expect(out.reconcile_status).toBe("base_updated");

      const reloaded = await repo.findById(sheet.personal_chord_sheet_id);
      expect(reloaded!.reconcile_status).toBe("clean");
      expect(reloaded!.base_fingerprint).toBe(sheet.base_fingerprint);
    });

    it("busca o base com o id do DONO, não de quem lê", async () => {
      const sheet = await seed();
      const fake = new FakeGetChordSheet([baseSheet()]);
      const useCase = new GetPersonalChordSheetViewUseCase(
        repo,
        fake as never,
        applier,
      );

      await useCase.execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        owner_musician_id: OWNER,
      });

      expect(fake.execute).toHaveBeenCalledWith({
        musician_id: OWNER,
        music_library_id: MUSIC,
      });
    });
  });

  describe("CheckPersonalChordSheetAccessUseCase", () => {
    const seedWithScope = async (scope: "private" | "band" | "community") => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withMusicLibraryId(MUSIC)
        .withShareScope(scope)
        .build();
      await repo.insert(sheet);
      return sheet;
    };

    it("dono sempre acessa", async () => {
      const sheet = await seedWithScope("private");
      const out = await new CheckPersonalChordSheetAccessUseCase(repo).execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        requesting_musician_id: OWNER,
      });

      expect(out.is_owner).toBe(true);
      expect(out.owner_musician_id).toBe(OWNER);
    });

    it("terceiro NÃO acessa fork privado", async () => {
      const sheet = await seedWithScope("private");
      await expect(
        new CheckPersonalChordSheetAccessUseCase(repo).execute({
          personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
          requesting_musician_id: OTHER,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("terceiro acessa fork da comunidade", async () => {
      const sheet = await seedWithScope("community");
      const out = await new CheckPersonalChordSheetAccessUseCase(repo).execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        requesting_musician_id: OTHER,
      });

      expect(out.is_owner).toBe(false);
    });

    it("fork de banda só abre para quem toca com o dono", async () => {
      const sheet = await seedWithScope("band");
      const useCase = new CheckPersonalChordSheetAccessUseCase(repo);

      await expect(
        useCase.execute({
          personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
          requesting_musician_id: OTHER,
          requesting_musician_band_peers: [],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const out = await useCase.execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        requesting_musician_id: OTHER,
        requesting_musician_band_peers: [OWNER],
      });
      expect(out.owner_musician_id).toBe(OWNER);
    });

    it("admin (sem requesting_musician_id) acessa qualquer fork", async () => {
      const sheet = await seedWithScope("private");
      const out = await new CheckPersonalChordSheetAccessUseCase(repo).execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
      });

      expect(out.owner_musician_id).toBe(OWNER);
      expect(out.is_owner).toBe(false);
    });
  });

  describe("mutações — ownership", () => {
    const seed = async () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withMusicLibraryId(MUSIC)
        .build();
      await repo.insert(sheet);
      return sheet;
    };

    it("ApplyChordEdits acrescenta edições do dono", async () => {
      const sheet = await seed();
      const out = await new ApplyChordEditsUseCase(repo).execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        musician_id: OWNER,
        edits: [{ type: "replace_chord", at_ms: 2000, from: "Am", to: "Am7" }],
      });

      expect(out.edit_count).toBe(1);
      expect(out.edits[0]).toMatchObject({ type: "replace_chord", to: "Am7" });
    });

    it("ApplyChordEdits em modo replace troca a lista", async () => {
      const sheet = await seed();
      const useCase = new ApplyChordEditsUseCase(repo);
      await useCase.execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        musician_id: OWNER,
        edits: [{ type: "insert_chord", at_ms: 100, symbol: "C" }],
      });

      const out = await useCase.execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        musician_id: OWNER,
        edits: [{ type: "insert_chord", at_ms: 500, symbol: "G" }],
        mode: "replace",
      });

      expect(out.edit_count).toBe(1);
      expect(out.edits[0].at_ms).toBe(500);
    });

    it.each([
      [
        "ApplyChordEdits",
        (id: string) =>
          new ApplyChordEditsUseCase(repo).execute({
            personal_chord_sheet_id: id,
            musician_id: OTHER,
            edits: [{ type: "insert_chord", at_ms: 0, symbol: "C" }],
          }),
      ],
      [
        "RemoveChordEdit",
        (id: string) =>
          new RemoveChordEditUseCase(repo).execute({
            personal_chord_sheet_id: id,
            musician_id: OTHER,
            edit_id: "qualquer",
          }),
      ],
      [
        "UpdateViewSettings",
        (id: string) =>
          new UpdateViewSettingsUseCase(repo).execute({
            personal_chord_sheet_id: id,
            musician_id: OTHER,
            view: { transpose_semitones: 2 },
          }),
      ],
      [
        "UpdatePersonalNotes",
        (id: string) =>
          new UpdatePersonalNotesUseCase(repo).execute({
            personal_chord_sheet_id: id,
            musician_id: OTHER,
            notes: "invadindo",
          }),
      ],
      [
        "SharePersonalChordSheet",
        (id: string) =>
          new SharePersonalChordSheetUseCase(repo, fakePlanCheck()).execute({
            personal_chord_sheet_id: id,
            musician_id: OTHER,
            scope: "community",
          }),
      ],
      [
        "DeletePersonalChordSheet",
        (id: string) =>
          new DeletePersonalChordSheetUseCase(repo).execute({
            personal_chord_sheet_id: id,
            requesting_musician_id: OTHER,
          }),
      ],
    ])("%s bloqueia quem não é dono", async (_nome, act) => {
      const sheet = await seed();
      await expect(
        act(sheet.personal_chord_sheet_id.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("admin pode deletar fork de qualquer músico (moderação)", async () => {
      const sheet = await seed();
      await new DeletePersonalChordSheetUseCase(repo).execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
      });

      expect(await repo.findById(sheet.personal_chord_sheet_id)).toBeNull();
    });

    it("UpdateViewSettings faz PATCH parcial", async () => {
      const sheet = await seed();
      const useCase = new UpdateViewSettingsUseCase(repo);

      await useCase.execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        musician_id: OWNER,
        view: { transpose_semitones: 3, instrument: "ukulele" },
      });
      const out = await useCase.execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        musician_id: OWNER,
        view: { capo_fret: 2 },
      });

      expect(out.view.transpose_semitones).toBe(3);
      expect(out.view.instrument).toBe("ukulele");
      expect(out.view.capo_fret).toBe(2);
    });
  });

  describe("compartilhamento", () => {
    const seed = async () => {
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withMusicLibraryId(MUSIC)
        .build();
      await repo.insert(sheet);
      return sheet;
    };

    it("share e unshare alternam o escopo", async () => {
      const sheet = await seed();
      const shared = await new SharePersonalChordSheetUseCase(
        repo,
        fakePlanCheck(),
      ).execute({
        personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
        musician_id: OWNER,
        scope: "community",
      });
      expect(shared.share_scope).toBe("community");
      expect(shared.is_shared).toBe(true);
      expect(shared.shared_at).not.toBeNull();

      const unshared = await new UnsharePersonalChordSheetUseCase(repo).execute(
        {
          personal_chord_sheet_id: sheet.personal_chord_sheet_id.id,
          musician_id: OWNER,
        },
      );
      expect(unshared.share_scope).toBe("private");
      expect(unshared.shared_at).toBeNull();
    });
  });

  describe("listagens", () => {
    it("ListPersonalChordSheets escopa ao músico do token", async () => {
      await repo.bulkInsert([
        PersonalChordSheet.fake()
          .aPersonalChordSheet()
          .withMusicianId(OWNER)
          .build(),
        PersonalChordSheet.fake()
          .aPersonalChordSheet()
          .withMusicianId(OWNER)
          .build(),
        PersonalChordSheet.fake()
          .aPersonalChordSheet()
          .withMusicianId(OTHER)
          .build(),
      ]);

      const out = await new ListPersonalChordSheetsUseCase(readModel).execute({
        musician_id: OWNER,
      });

      expect(out.total).toBe(2);
      expect(out.items.every((i) => i.musician_id === OWNER)).toBe(true);
    });

    it("ListCommunity só devolve escopo community, nunca band nem private", async () => {
      await repo.bulkInsert([
        PersonalChordSheet.fake()
          .aPersonalChordSheet()
          .withShareScope("community")
          .build(),
        PersonalChordSheet.fake()
          .aPersonalChordSheet()
          .withShareScope("band")
          .build(),
        PersonalChordSheet.fake()
          .aPersonalChordSheet()
          .withShareScope("private")
          .build(),
      ]);

      const out = await new ListCommunityChordSheetsUseCase(readModel).execute(
        {},
      );

      expect(out.total).toBe(1);
      expect(out.items[0].share_scope).toBe("community");
    });

    it("ListCommunity esconde as anotações privadas do autor", async () => {
      await repo.insert(
        PersonalChordSheet.fake()
          .aPersonalChordSheet()
          .withShareScope("community")
          .withNotes("meu caderno pessoal")
          .build(),
      );

      const out = await new ListCommunityChordSheetsUseCase(readModel).execute(
        {},
      );
      expect(out.items[0].notes).toBeNull();
    });

    /**
     * O contrato do read-model: a listagem devolve QUANTAS correções existem,
     * nunca o array. É o que permite o Postgres contar com jsonb_array_length
     * sem trazer a coluna `edits` (até 60 KB por linha) para o Node.
     */
    it("a listagem devolve edit_count e nunca o array de edits", async () => {
      await repo.insert(
        PersonalChordSheet.fake()
          .aPersonalChordSheet()
          .withMusicianId(OWNER)
          .withEdits([
            ChordEdit.replaceChord({ at_ms: 0, from: "C", to: "C7" }),
            ChordEdit.replaceChord({ at_ms: 2000, from: "Am", to: "Am7" }),
          ])
          .build(),
      );

      const out = await new ListPersonalChordSheetsUseCase(readModel).execute({
        musician_id: OWNER,
      });

      expect(out.items[0].edit_count).toBe(2);
      expect(out.items[0]).not.toHaveProperty("edits");
    });
  });

  describe("ImportCommunityChordSheetUseCase", () => {
    const seedSource = async (
      scope: "community" | "private" = "community",
      fingerprint = computeChordSheetBaseFingerprint(
        baseSheet().chords.timeline,
      ),
    ) => {
      const source = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OTHER)
        .withMusicLibraryId(MUSIC)
        .withShareScope(scope)
        .withBaseFingerprint(fingerprint)
        .withEdits([
          ChordEdit.replaceChord({ at_ms: 2000, from: "Am", to: "Am7" }),
        ])
        .withView(ChordSheetViewSettings.create({ transpose_semitones: 2 }))
        .build();
      await repo.insert(source);
      return source;
    };

    it("copia as correções para a cópia do importador", async () => {
      const source = await seedSource();
      const useCase = new ImportCommunityChordSheetUseCase(
        repo,
        new FakeGetChordSheet([baseSheet(OWNER, OTHER_MUSIC)]) as never,
        applier,
        fakePlanCheck(),
      );

      const out = await useCase.execute({
        source_personal_chord_sheet_id: source.personal_chord_sheet_id.id,
        musician_id: OWNER,
        target_music_library_id: OTHER_MUSIC,
      });

      expect(out.personal_chord_sheet.musician_id).toBe(OWNER);
      expect(out.personal_chord_sheet.music_library_id).toBe(OTHER_MUSIC);
      expect(out.personal_chord_sheet.edit_count).toBe(1);
      expect(out.conflict_count).toBe(0);
      expect(out.personal_chord_sheet.view.transpose_semitones).toBe(2);
    });

    it("não importa de fork que não é da comunidade", async () => {
      const source = await seedSource("private");
      const useCase = new ImportCommunityChordSheetUseCase(
        repo,
        new FakeGetChordSheet([baseSheet(OWNER, OTHER_MUSIC)]) as never,
        applier,
        fakePlanCheck(),
      );

      await expect(
        useCase.execute({
          source_personal_chord_sheet_id: source.personal_chord_sheet_id.id,
          musician_id: OWNER,
          target_music_library_id: OTHER_MUSIC,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    /**
     * O caso que justifica o import existir: as duas análises divergem, então
     * a correção do autor não acha onde ancorar na cifra do importador.
     */
    it("descarta correção que não ancora e reporta o conflito", async () => {
      const source = await seedSource();
      const analiseDiferente = baseSheet(OWNER, OTHER_MUSIC, [
        { startMs: 0, endMs: 5000, symbol: "C" },
        { startMs: 5000, endMs: 9000, symbol: "G" },
      ]);

      const out = await new ImportCommunityChordSheetUseCase(
        repo,
        new FakeGetChordSheet([analiseDiferente]) as never,
        applier,
        fakePlanCheck(),
      ).execute({
        source_personal_chord_sheet_id: source.personal_chord_sheet_id.id,
        musician_id: OWNER,
        target_music_library_id: OTHER_MUSIC,
      });

      expect(out.base_differs).toBe(true);
      expect(out.conflict_count).toBe(1);
      expect(out.personal_chord_sheet.edit_count).toBe(0);
    });

    it("recusa importar sobre música que já tem fork", async () => {
      const source = await seedSource();
      await repo.insert(
        PersonalChordSheet.fake()
          .aPersonalChordSheet()
          .withMusicianId(OWNER)
          .withMusicLibraryId(OTHER_MUSIC)
          .build(),
      );

      await expect(
        new ImportCommunityChordSheetUseCase(
          repo,
          new FakeGetChordSheet([baseSheet(OWNER, OTHER_MUSIC)]) as never,
          applier,
          fakePlanCheck(),
        ).execute({
          source_personal_chord_sheet_id: source.personal_chord_sheet_id.id,
          musician_id: OWNER,
          target_music_library_id: OTHER_MUSIC,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });
});
