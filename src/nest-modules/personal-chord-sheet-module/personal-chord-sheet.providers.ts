import { ListBandsUseCase } from "../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import { IBandRepository } from "../../core/musician/domain/band.repository";
import { IPersonalChordSheetReadModel } from "../../core/personal-chord-sheet/application/gateways/personal-chord-sheet-read-model.interface";
import { ChordSheetOverlayApplier } from "../../core/personal-chord-sheet/application/services/chord-sheet-overlay-applier";
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
} from "../../core/personal-chord-sheet/application/use-cases/index";
import { IPersonalChordSheetRepository } from "../../core/personal-chord-sheet/domain/personal-chord-sheet.repository";
import { PersonalChordSheetPrismaReadModel } from "../../core/personal-chord-sheet/infra/db/prisma/personal-chord-sheet-prisma.read-model";
import { PersonalChordSheetPrismaRepository } from "../../core/personal-chord-sheet/infra/db/prisma/personal-chord-sheet-prisma.repository";
import { PlanCheckService } from "../../core/plans/domain/plan-check.service";
import { GetChordSheetForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/get-chord-sheet-for-music-library/get-chord-sheet-for-music-library.use-case";
import { PrismaService } from "../database-module/prisma/prisma.service";

/** Kill-switch da comunidade — ver personal-chord-sheet.module.ts. */
export const PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED =
  "PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED";

export const REPOSITORIES = {
  PERSONAL_CHORD_SHEET_REPOSITORY: {
    provide: "PersonalChordSheetRepository",
    useExisting: PersonalChordSheetPrismaRepository,
  },
  PERSONAL_CHORD_SHEET_PRISMA_REPOSITORY: {
    provide: PersonalChordSheetPrismaRepository,
    useFactory: (prismaService: PrismaService) =>
      new PersonalChordSheetPrismaRepository(prismaService),
    inject: [PrismaService],
  },
  /**
   * Projeção de listagem, separada do repositório de propósito: devolve linhas
   * sem o array de edits (ver IPersonalChordSheetReadModel).
   */
  PERSONAL_CHORD_SHEET_READ_MODEL: {
    provide: "PersonalChordSheetReadModel",
    useExisting: PersonalChordSheetPrismaReadModel,
  },
  PERSONAL_CHORD_SHEET_PRISMA_READ_MODEL: {
    provide: PersonalChordSheetPrismaReadModel,
    useFactory: (prismaService: PrismaService) =>
      new PersonalChordSheetPrismaReadModel(prismaService),
    inject: [PrismaService],
  },
};

export const SERVICES = {
  CHORD_SHEET_OVERLAY_APPLIER: {
    provide: ChordSheetOverlayApplier,
    // Sem argumentos: a tolerância de ancoragem padrão (250ms) é a mesma para
    // todo mundo — é característica musical, não configuração de deploy.
    useFactory: () => new ChordSheetOverlayApplier(),
  },
};

export const USE_CASES = {
  FORK_CHORD_SHEET_USE_CASE: {
    provide: ForkChordSheetUseCase,
    useFactory: (
      repo: IPersonalChordSheetRepository,
      getChordSheet: GetChordSheetForMusicLibraryUseCase,
      plan: PlanCheckService,
    ) => new ForkChordSheetUseCase(repo, getChordSheet, plan),
    inject: [
      REPOSITORIES.PERSONAL_CHORD_SHEET_REPOSITORY.provide,
      GetChordSheetForMusicLibraryUseCase,
      PlanCheckService,
    ],
  },
  GET_PERSONAL_CHORD_SHEET_USE_CASE: {
    provide: GetPersonalChordSheetUseCase,
    useFactory: (repo: IPersonalChordSheetRepository) =>
      new GetPersonalChordSheetUseCase(repo),
    inject: [REPOSITORIES.PERSONAL_CHORD_SHEET_REPOSITORY.provide],
  },
  GET_PERSONAL_CHORD_SHEET_VIEW_USE_CASE: {
    provide: GetPersonalChordSheetViewUseCase,
    useFactory: (
      repo: IPersonalChordSheetRepository,
      getChordSheet: GetChordSheetForMusicLibraryUseCase,
      applier: ChordSheetOverlayApplier,
    ) => new GetPersonalChordSheetViewUseCase(repo, getChordSheet, applier),
    inject: [
      REPOSITORIES.PERSONAL_CHORD_SHEET_REPOSITORY.provide,
      GetChordSheetForMusicLibraryUseCase,
      ChordSheetOverlayApplier,
    ],
  },
  LIST_PERSONAL_CHORD_SHEETS_USE_CASE: {
    provide: ListPersonalChordSheetsUseCase,
    useFactory: (readModel: IPersonalChordSheetReadModel) =>
      new ListPersonalChordSheetsUseCase(readModel),
    inject: [REPOSITORIES.PERSONAL_CHORD_SHEET_READ_MODEL.provide],
  },
  LIST_COMMUNITY_CHORD_SHEETS_USE_CASE: {
    provide: ListCommunityChordSheetsUseCase,
    useFactory: (readModel: IPersonalChordSheetReadModel) =>
      new ListCommunityChordSheetsUseCase(readModel),
    inject: [REPOSITORIES.PERSONAL_CHORD_SHEET_READ_MODEL.provide],
  },
  APPLY_CHORD_EDITS_USE_CASE: {
    provide: ApplyChordEditsUseCase,
    useFactory: (repo: IPersonalChordSheetRepository) =>
      new ApplyChordEditsUseCase(repo),
    inject: [REPOSITORIES.PERSONAL_CHORD_SHEET_REPOSITORY.provide],
  },
  REMOVE_CHORD_EDIT_USE_CASE: {
    provide: RemoveChordEditUseCase,
    useFactory: (repo: IPersonalChordSheetRepository) =>
      new RemoveChordEditUseCase(repo),
    inject: [REPOSITORIES.PERSONAL_CHORD_SHEET_REPOSITORY.provide],
  },
  UPDATE_VIEW_SETTINGS_USE_CASE: {
    provide: UpdateViewSettingsUseCase,
    useFactory: (repo: IPersonalChordSheetRepository) =>
      new UpdateViewSettingsUseCase(repo),
    inject: [REPOSITORIES.PERSONAL_CHORD_SHEET_REPOSITORY.provide],
  },
  UPDATE_PERSONAL_NOTES_USE_CASE: {
    provide: UpdatePersonalNotesUseCase,
    useFactory: (repo: IPersonalChordSheetRepository) =>
      new UpdatePersonalNotesUseCase(repo),
    inject: [REPOSITORIES.PERSONAL_CHORD_SHEET_REPOSITORY.provide],
  },
  SHARE_PERSONAL_CHORD_SHEET_USE_CASE: {
    provide: SharePersonalChordSheetUseCase,
    useFactory: (repo: IPersonalChordSheetRepository, plan: PlanCheckService) =>
      new SharePersonalChordSheetUseCase(repo, plan),
    inject: [
      REPOSITORIES.PERSONAL_CHORD_SHEET_REPOSITORY.provide,
      PlanCheckService,
    ],
  },
  UNSHARE_PERSONAL_CHORD_SHEET_USE_CASE: {
    provide: UnsharePersonalChordSheetUseCase,
    useFactory: (repo: IPersonalChordSheetRepository) =>
      new UnsharePersonalChordSheetUseCase(repo),
    inject: [REPOSITORIES.PERSONAL_CHORD_SHEET_REPOSITORY.provide],
  },
  DELETE_PERSONAL_CHORD_SHEET_USE_CASE: {
    provide: DeletePersonalChordSheetUseCase,
    useFactory: (repo: IPersonalChordSheetRepository) =>
      new DeletePersonalChordSheetUseCase(repo),
    inject: [REPOSITORIES.PERSONAL_CHORD_SHEET_REPOSITORY.provide],
  },
  CHECK_PERSONAL_CHORD_SHEET_ACCESS_USE_CASE: {
    provide: CheckPersonalChordSheetAccessUseCase,
    useFactory: (repo: IPersonalChordSheetRepository) =>
      new CheckPersonalChordSheetAccessUseCase(repo),
    inject: [REPOSITORIES.PERSONAL_CHORD_SHEET_REPOSITORY.provide],
  },
  IMPORT_COMMUNITY_CHORD_SHEET_USE_CASE: {
    provide: ImportCommunityChordSheetUseCase,
    useFactory: (
      repo: IPersonalChordSheetRepository,
      getChordSheet: GetChordSheetForMusicLibraryUseCase,
      applier: ChordSheetOverlayApplier,
      plan: PlanCheckService,
    ) =>
      new ImportCommunityChordSheetUseCase(repo, getChordSheet, applier, plan),
    inject: [
      REPOSITORIES.PERSONAL_CHORD_SHEET_REPOSITORY.provide,
      GetChordSheetForMusicLibraryUseCase,
      ChordSheetOverlayApplier,
      PlanCheckService,
    ],
  },
  /**
   * Instância PRÓPRIA, montada sobre o "BandRepository" exportado por
   * MusiciansModule — o módulo de músicos não exporta o use-case, e importar
   * o token do repositório é diff menor do que ampliar os exports de lá.
   * Serve só para resolver os pares de banda do leitor (share_scope "band").
   */
  LIST_BANDS_USE_CASE: {
    provide: ListBandsUseCase,
    useFactory: (bandRepo: IBandRepository) => new ListBandsUseCase(bandRepo),
    inject: ["BandRepository"],
  },
};

export const PERSONAL_CHORD_SHEET_PROVIDERS = {
  REPOSITORIES,
  SERVICES,
  USE_CASES,
};
