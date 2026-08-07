import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { ListBandsUseCase } from "../../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import { Band } from "../../../core/musician/domain/band.aggregate";
import { IBandRepository } from "../../../core/musician/domain/band.repository";
import { BandInMemoryRepository } from "../../../core/musician/infra/db/in-memory/band-in-memory.repository";
import { ChordSheetOverlayApplier } from "../../../core/personal-chord-sheet/application/services/chord-sheet-overlay-applier";
import {
  ApplyChordEditsUseCase,
  CheckPersonalChordSheetAccessUseCase,
  DeletePersonalChordSheetUseCase,
  ForkChordSheetUseCase,
  GetPersonalChordSheetUseCase,
  GetPersonalChordSheetViewUseCase,
  ImportCommunityChordSheetUseCase,
  ListCommunityChordSheetsUseCase,
  ListPersonalChordSheetsUseCase,
  RemoveChordEditUseCase,
  SharePersonalChordSheetUseCase,
  UnsharePersonalChordSheetUseCase,
  UpdatePersonalNotesUseCase,
  UpdateViewSettingsUseCase,
} from "../../../core/personal-chord-sheet/application/use-cases/index";
import { PersonalChordSheet } from "../../../core/personal-chord-sheet/domain/personal-chord-sheet.aggregate";
import { IPersonalChordSheetRepository } from "../../../core/personal-chord-sheet/domain/personal-chord-sheet.repository";
import { PersonalChordSheetInMemoryReadModel } from "../../../core/personal-chord-sheet/infra/db/in-memory/personal-chord-sheet-in-memory.read-model";
import { PersonalChordSheetInMemoryRepository } from "../../../core/personal-chord-sheet/infra/db/in-memory/personal-chord-sheet-in-memory.repository";
import { PlanLimitExceededError } from "../../../core/plans/domain/errors/plan-limit-exceeded.error";
import { ConflictError } from "../../../core/shared/domain/errors/conflict.error";
import { NotFoundError } from "../../../core/shared/domain/errors/not-found.error";
import { Uuid } from "../../../core/shared/domain/value-objects/uuid.vo";
import type { ChordSheetOutput } from "../../../core/synced-lyrics/application/use-cases/common/chord-sheet-output";
import { GetChordSheetForMusicLibraryUseCase } from "../../../core/synced-lyrics/application/use-cases/get-chord-sheet-for-music-library/get-chord-sheet-for-music-library.use-case";
import {
  applyAuthGuardMocksAs,
  musicianAuthUser,
} from "../../shared-module/testing/auth-guard-mock";
import {
  CommunityChordSheetController,
  PersonalChordSheetAdminController,
  PersonalChordSheetController,
} from "../personal-chord-sheet.controller";
import { PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED } from "../personal-chord-sheet.providers";

const OWNER = "11111111-1111-4111-8111-111111111111";
const READER = "22222222-2222-4222-8222-222222222222";
const OWNER_MUSIC = "33333333-3333-4333-8333-333333333333";
const READER_MUSIC = "44444444-4444-4444-8444-444444444444";

function chordSheetOutput(
  musician_id: string,
  music_library_id: string,
): ChordSheetOutput {
  return {
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
    chords: {
      timeline: [
        { startMs: 0, endMs: 2000, symbol: "C" },
        { startMs: 2000, endMs: 4000, symbol: "Am" },
        { startMs: 4000, endMs: 6000, symbol: "F" },
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
    updated_at: new Date("2026-07-29T00:00:00.000Z"),
  };
}

/** Duplê do use-case base: valida posse da música e devolve o artefato. */
class FakeGetChordSheet {
  execute = jest.fn(
    async (input: { musician_id: string; music_library_id: string }) => {
      const owns =
        (input.musician_id === OWNER &&
          input.music_library_id === OWNER_MUSIC) ||
        (input.musician_id === READER &&
          input.music_library_id === READER_MUSIC);
      if (!owns) {
        throw new NotFoundError(input.music_library_id, PersonalChordSheet);
      }
      return chordSheetOutput(input.musician_id, input.music_library_id);
    },
  );
}

/** PlanCheckService controlável — `limitReached` liga o 402. */
class FakePlanCheck {
  limitReached = false;
  communitySharingAllowed = true;

  assertMusicianCanCreatePersonalChordSheet = jest.fn(async () => {
    if (this.limitReached) {
      throw new PlanLimitExceededError("Limite de 3 cifra(s) pessoal(is).");
    }
  });

  assertMusicianFeature = jest.fn(async () => {
    if (!this.communitySharingAllowed) {
      throw new PlanLimitExceededError("Funcionalidade indisponível no plano.");
    }
  });
}

type Harness = {
  module: TestingModule;
  owner: PersonalChordSheetController;
  community: CommunityChordSheetController;
  admin: PersonalChordSheetAdminController;
  repo: IPersonalChordSheetRepository;
  bandRepo: IBandRepository;
  plan: FakePlanCheck;
  getChordSheet: FakeGetChordSheet;
};

async function buildHarness(
  options: { as?: string; communityEnabled?: boolean } = {},
): Promise<Harness> {
  const repo = new PersonalChordSheetInMemoryRepository();
  const readModel = new PersonalChordSheetInMemoryReadModel(repo);
  const bandRepo = new BandInMemoryRepository();
  const plan = new FakePlanCheck();
  const getChordSheet = new FakeGetChordSheet();
  const applier = new ChordSheetOverlayApplier();

  const builder = Test.createTestingModule({
    controllers: [
      PersonalChordSheetController,
      CommunityChordSheetController,
      PersonalChordSheetAdminController,
    ],
    providers: [
      { provide: "PersonalChordSheetRepository", useValue: repo },
      { provide: "PersonalChordSheetReadModel", useValue: readModel },
      { provide: "BandRepository", useValue: bandRepo },
      { provide: ChordSheetOverlayApplier, useValue: applier },
      { provide: GetChordSheetForMusicLibraryUseCase, useValue: getChordSheet },
      {
        provide: PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED,
        useValue: options.communityEnabled ?? true,
      },
      {
        provide: ForkChordSheetUseCase,
        useValue: new ForkChordSheetUseCase(
          repo,
          getChordSheet as never,
          plan as never,
        ),
      },
      {
        provide: GetPersonalChordSheetUseCase,
        useValue: new GetPersonalChordSheetUseCase(repo),
      },
      {
        provide: GetPersonalChordSheetViewUseCase,
        useValue: new GetPersonalChordSheetViewUseCase(
          repo,
          getChordSheet as never,
          applier,
        ),
      },
      {
        provide: ListPersonalChordSheetsUseCase,
        useValue: new ListPersonalChordSheetsUseCase(readModel),
      },
      {
        provide: ListCommunityChordSheetsUseCase,
        useValue: new ListCommunityChordSheetsUseCase(readModel),
      },
      {
        provide: ApplyChordEditsUseCase,
        useValue: new ApplyChordEditsUseCase(repo),
      },
      {
        provide: RemoveChordEditUseCase,
        useValue: new RemoveChordEditUseCase(repo),
      },
      {
        provide: UpdateViewSettingsUseCase,
        useValue: new UpdateViewSettingsUseCase(repo),
      },
      {
        provide: UpdatePersonalNotesUseCase,
        useValue: new UpdatePersonalNotesUseCase(repo),
      },
      {
        provide: SharePersonalChordSheetUseCase,
        useValue: new SharePersonalChordSheetUseCase(repo, plan as never),
      },
      {
        provide: UnsharePersonalChordSheetUseCase,
        useValue: new UnsharePersonalChordSheetUseCase(repo),
      },
      {
        provide: DeletePersonalChordSheetUseCase,
        useValue: new DeletePersonalChordSheetUseCase(repo),
      },
      {
        provide: CheckPersonalChordSheetAccessUseCase,
        useValue: new CheckPersonalChordSheetAccessUseCase(repo),
      },
      {
        provide: ImportCommunityChordSheetUseCase,
        useValue: new ImportCommunityChordSheetUseCase(
          repo,
          getChordSheet as never,
          applier,
          plan as never,
        ),
      },
      {
        provide: ListBandsUseCase,
        useValue: new ListBandsUseCase(bandRepo),
      },
    ],
  });

  const module = await applyAuthGuardMocksAs(
    musicianAuthUser(options.as ?? OWNER),
  )(builder).compile();

  return {
    module,
    owner: module.get(PersonalChordSheetController),
    community: module.get(CommunityChordSheetController),
    admin: module.get(PersonalChordSheetAdminController),
    repo,
    bandRepo,
    plan,
    getChordSheet,
  };
}

describe("PersonalChordSheet HTTP Integration Tests", () => {
  describe("fork (rota do dono)", () => {
    it("cria o fork da música do próprio músico", async () => {
      const h = await buildHarness();

      const presenter = await h.owner.fork(OWNER, {
        music_library_id: OWNER_MUSIC,
      });

      expect(presenter.musician_id).toBe(OWNER);
      expect(presenter.music_library_id).toBe(OWNER_MUSIC);
      expect(presenter.edits).toEqual([]);
      expect(presenter.share_scope).toBe("private");
    });

    it("recusa o segundo fork da mesma música (409)", async () => {
      const h = await buildHarness();
      await h.owner.fork(OWNER, { music_library_id: OWNER_MUSIC });

      await expect(
        h.owner.fork(OWNER, { music_library_id: OWNER_MUSIC }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    /** FREE estourando max_personal_chord_sheets → PlanLimitExceededError (402). */
    it("recusa o fork quando o plano estourou (402)", async () => {
      const h = await buildHarness();
      h.plan.limitReached = true;

      await expect(
        h.owner.fork(OWNER, { music_library_id: OWNER_MUSIC }),
      ).rejects.toBeInstanceOf(PlanLimitExceededError);
    });
  });

  describe("leitura pela rota do dono", () => {
    /**
     * Regressão do IDOR: o MusicianOwnershipGuard aprova esta URL porque o
     * musician_id É o do token — ele não tem como saber de quem é o fork que
     * veio no path. A checagem de posse tem de estar no use-case, como nas
     * mutações; antes disso a resposta saía 200 com as `notes` da vítima.
     */
    it("bloqueia ler o fork de outro músico pela própria URL (403)", async () => {
      const h = await buildHarness({ as: READER });
      const victim = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withMusicLibraryId(OWNER_MUSIC)
        .withShareScope("private")
        .withNotes("segredo do palco")
        .build();
      await h.repo.insert(victim);

      await expect(
        h.owner.findOne(READER, victim.personal_chord_sheet_id.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("o dono lê o próprio fork com as anotações", async () => {
      const h = await buildHarness({ as: OWNER });
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withMusicLibraryId(OWNER_MUSIC)
        .withNotes("segurar o Am7 no refrão")
        .build();
      await h.repo.insert(sheet);

      const presenter = await h.owner.findOne(
        OWNER,
        sheet.personal_chord_sheet_id.id,
      );

      expect(presenter.notes).toBe("segurar o Am7 no refrão");
    });
  });

  describe("leitura de terceiro", () => {
    /** Fork privado é invisível para quem não é o dono. */
    it("bloqueia terceiro lendo um fork privado (403)", async () => {
      const h = await buildHarness({ as: READER });
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withMusicLibraryId(OWNER_MUSIC)
        .withShareScope("private")
        .build();
      await h.repo.insert(sheet);

      await expect(
        h.community.findOne(sheet.personal_chord_sheet_id.id, {
          userId: READER,
          isAdmin: false,
        } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    /**
     * O contrato central do módulo: a comunidade vê as CORREÇÕES, nunca o
     * caderno pessoal do autor.
     */
    it("terceiro lê fork community com notes redigido (200)", async () => {
      const h = await buildHarness({ as: READER });
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withMusicLibraryId(OWNER_MUSIC)
        .withShareScope("community")
        .withNotes("segredo do palco")
        .build();
      await h.repo.insert(sheet);

      const presenter = await h.community.findOne(
        sheet.personal_chord_sheet_id.id,
        { userId: READER, isAdmin: false } as never,
      );

      expect(presenter.notes).toBeNull();
      expect(presenter.musician_id).toBe(OWNER);
      expect(presenter.share_scope).toBe("community");
    });

    /**
     * A armadilha do musician_id: o use-case base precisa do id do DONO, porque
     * a linha de music_library é dele. Passar o do leitor daria NotFoundError.
     */
    it("a rota de comunidade chama o base com o owner_musician_id", async () => {
      const h = await buildHarness({ as: READER });
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withMusicLibraryId(OWNER_MUSIC)
        .withShareScope("community")
        .build();
      await h.repo.insert(sheet);

      await h.community.chordSheet(sheet.personal_chord_sheet_id.id, {}, {
        userId: READER,
        isAdmin: false,
      } as never);

      expect(h.getChordSheet.execute).toHaveBeenCalledWith({
        musician_id: OWNER,
        music_library_id: OWNER_MUSIC,
      });
    });

    /** share_scope "band" só é legível por quem divide banda com o autor. */
    it("libera fork band para o par de banda e barra o estranho", async () => {
      const h = await buildHarness({ as: READER });

      const band = Band.fake()
        .aBand()
        .withMembers([
          {
            musician_id: new Uuid(OWNER),
            role: "leader",
            instrument: "guitarra",
            status: "accepted",
            joined_at: new Date(),
            responded_at: new Date(),
          },
          {
            musician_id: new Uuid(READER),
            role: "member",
            instrument: "baixo",
            status: "accepted",
            joined_at: new Date(),
            responded_at: new Date(),
          },
        ])
        .build();
      await h.bandRepo.insert(band);

      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withMusicLibraryId(OWNER_MUSIC)
        .withShareScope("band")
        .build();
      await h.repo.insert(sheet);

      const presenter = await h.community.findOne(
        sheet.personal_chord_sheet_id.id,
        { userId: READER, isAdmin: false } as never,
      );
      expect(presenter.musician_id).toBe(OWNER);

      // Um músico sem banda em comum continua barrado.
      const stranger = await buildHarness({
        as: "55555555-5555-4555-8555-555555555555",
      });
      await stranger.repo.insert(sheet);
      await expect(
        stranger.community.findOne(sheet.personal_chord_sheet_id.id, {
          userId: "55555555-5555-4555-8555-555555555555",
          isAdmin: false,
        } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    /**
     * Os pares de banda vinham de uma página só de ListBands. O par que caísse
     * fora dela levava 403 num fork que é legitimamente dele para ler, e em
     * silêncio: daqui, truncamento e "não é seu par de banda" são a mesma coisa.
     */
    it("varre todas as páginas de bandas ao resolver os pares", async () => {
      const h = await buildHarness({ as: READER });

      const bandPage = (musicians: string[], last_page: number) => ({
        items: [
          {
            members: musicians.map((musician_id) => ({
              musician_id,
              status: "accepted",
            })),
          },
        ],
        total: last_page,
        current_page: 1,
        per_page: 100,
        last_page,
      });

      // O dono do fork só aparece na SEGUNDA página.
      const listBands = h.module.get(ListBandsUseCase);
      const spy = jest
        .spyOn(listBands, "execute")
        .mockResolvedValueOnce(bandPage([READER], 2) as never)
        .mockResolvedValueOnce(bandPage([READER, OWNER], 2) as never);

      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withMusicLibraryId(OWNER_MUSIC)
        .withShareScope("band")
        .build();
      await h.repo.insert(sheet);

      const presenter = await h.community.findOne(
        sheet.personal_chord_sheet_id.id,
        { userId: READER, isAdmin: false } as never,
      );

      expect(presenter.musician_id).toBe(OWNER);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1][0]).toMatchObject({ page: 2 });
    });
  });

  describe("compartilhamento", () => {
    it("recusa publicar na comunidade sem o recurso no plano (402)", async () => {
      const h = await buildHarness();
      h.plan.communitySharingAllowed = false;

      const forked = await h.owner.fork(OWNER, {
        music_library_id: OWNER_MUSIC,
      });

      await expect(
        h.owner.share(OWNER, forked.personal_chord_sheet_id, {
          scope: "community",
        }),
      ).rejects.toBeInstanceOf(PlanLimitExceededError);
    });

    /** Compartilhar com a banda é core em todos os tiers — não passa pelo gate. */
    it("permite compartilhar com a banda mesmo sem o recurso pago", async () => {
      const h = await buildHarness();
      h.plan.communitySharingAllowed = false;

      const forked = await h.owner.fork(OWNER, {
        music_library_id: OWNER_MUSIC,
      });

      const presenter = await h.owner.share(
        OWNER,
        forked.personal_chord_sheet_id,
        { scope: "band" },
      );

      expect(presenter.share_scope).toBe("band");
      expect(h.plan.assertMusicianFeature).not.toHaveBeenCalled();
    });
  });

  describe("admin", () => {
    it("remove fork alheio (takedown)", async () => {
      const h = await buildHarness();
      const sheet = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withMusicianId(OWNER)
        .withShareScope("community")
        .build();
      await h.repo.insert(sheet);

      await h.admin.remove(sheet.personal_chord_sheet_id.id);

      expect(await h.repo.findById(sheet.personal_chord_sheet_id)).toBeNull();
    });
  });

  describe("kill-switch da comunidade", () => {
    it("desligada: rotas de comunidade respondem 404", async () => {
      const h = await buildHarness({ communityEnabled: false });

      await expect(h.community.findAll({})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    /** O ponto do kill-switch: ninguém perde a própria cifra. */
    it("desligada: as rotas do dono seguem intactas", async () => {
      const h = await buildHarness({ communityEnabled: false });

      const presenter = await h.owner.fork(OWNER, {
        music_library_id: OWNER_MUSIC,
      });
      expect(presenter.personal_chord_sheet_id).toBeDefined();

      const list = await h.owner.findAll(OWNER, {});
      expect(list.data).toHaveLength(1);
    });
  });

  describe("listagem", () => {
    it("devolve edit_count e nunca o array de edits", async () => {
      const h = await buildHarness();
      await h.owner.fork(OWNER, { music_library_id: OWNER_MUSIC });

      const list = await h.owner.findAll(OWNER, {});

      expect(list.data[0].edit_count).toBe(0);
      expect(list.data[0]).not.toHaveProperty("edits");
    });
  });
});
