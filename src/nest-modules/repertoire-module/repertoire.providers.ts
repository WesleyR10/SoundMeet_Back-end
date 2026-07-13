import { PlanCheckService } from "../../core/plans/domain/plan-check.service";
import { IMusicLibraryRepository } from "../../core/music-library/domain/music-library.repository";
import { IRepertoireRepository } from "../../core/repertoire/domain/repertoire.repository";
import { RepertoirePrismaRepository } from "../../core/repertoire/infra/db/prisma/repertoire-prisma.repository";
import {
  AddSongUseCase,
  CheckRepertoireSongAccessUseCase,
  CheckSharedSongAccessUseCase,
  CreateRepertoireUseCase,
  DeleteRepertoireUseCase,
  GetRepertoireUseCase,
  GetSharedRepertoireUseCase,
  InviteMusicianUseCase,
  ListMyInvitesUseCase,
  ListRepertoiresUseCase,
  RemoveSongUseCase,
  RenameRepertoireUseCase,
  ReorderSongsUseCase,
  RevokeInviteUseCase,
  ShareRepertoireUseCase,
  UnshareRepertoireUseCase,
} from "../../core/repertoire/application/use-cases/index";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const REPOSITORIES = {
  REPERTOIRE_REPOSITORY: {
    provide: "RepertoireRepository",
    useExisting: RepertoirePrismaRepository,
  },
  REPERTOIRE_PRISMA_REPOSITORY: {
    provide: RepertoirePrismaRepository,
    useFactory: (prismaService: PrismaService) => new RepertoirePrismaRepository(prismaService),
    inject: [PrismaService],
  },
};

export const USE_CASES = {
  CREATE_REPERTOIRE_USE_CASE: {
    provide: CreateRepertoireUseCase,
    useFactory: (repo: IRepertoireRepository, plan: PlanCheckService) =>
      new CreateRepertoireUseCase(repo, plan),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide, PlanCheckService],
  },
  GET_REPERTOIRE_USE_CASE: {
    provide: GetRepertoireUseCase,
    useFactory: (repo: IRepertoireRepository, mlRepo: IMusicLibraryRepository) =>
      new GetRepertoireUseCase(repo, mlRepo),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide, "MusicLibraryRepository"],
  },
  LIST_REPERTOIRES_USE_CASE: {
    provide: ListRepertoiresUseCase,
    useFactory: (repo: IRepertoireRepository) => new ListRepertoiresUseCase(repo),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide],
  },
  RENAME_REPERTOIRE_USE_CASE: {
    provide: RenameRepertoireUseCase,
    useFactory: (repo: IRepertoireRepository) => new RenameRepertoireUseCase(repo),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide],
  },
  DELETE_REPERTOIRE_USE_CASE: {
    provide: DeleteRepertoireUseCase,
    useFactory: (repo: IRepertoireRepository) => new DeleteRepertoireUseCase(repo),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide],
  },
  ADD_SONG_USE_CASE: {
    provide: AddSongUseCase,
    useFactory: (
      repo: IRepertoireRepository,
      mlRepo: IMusicLibraryRepository,
      plan: PlanCheckService,
    ) => new AddSongUseCase(repo, mlRepo, plan),
    inject: [
      REPOSITORIES.REPERTOIRE_REPOSITORY.provide,
      "MusicLibraryRepository",
      PlanCheckService,
    ],
  },
  REMOVE_SONG_USE_CASE: {
    provide: RemoveSongUseCase,
    useFactory: (repo: IRepertoireRepository) => new RemoveSongUseCase(repo),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide],
  },
  REORDER_SONGS_USE_CASE: {
    provide: ReorderSongsUseCase,
    useFactory: (repo: IRepertoireRepository) => new ReorderSongsUseCase(repo),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide],
  },
  SHARE_REPERTOIRE_USE_CASE: {
    provide: ShareRepertoireUseCase,
    useFactory: (repo: IRepertoireRepository, plan: PlanCheckService) =>
      new ShareRepertoireUseCase(repo, plan),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide, PlanCheckService],
  },
  UNSHARE_REPERTOIRE_USE_CASE: {
    provide: UnshareRepertoireUseCase,
    useFactory: (repo: IRepertoireRepository) => new UnshareRepertoireUseCase(repo),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide],
  },
  GET_SHARED_REPERTOIRE_USE_CASE: {
    provide: GetSharedRepertoireUseCase,
    useFactory: (repo: IRepertoireRepository, mlRepo: IMusicLibraryRepository) =>
      new GetSharedRepertoireUseCase(repo, mlRepo),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide, "MusicLibraryRepository"],
  },
  INVITE_MUSICIAN_USE_CASE: {
    provide: InviteMusicianUseCase,
    useFactory: (repo: IRepertoireRepository, plan: PlanCheckService) =>
      new InviteMusicianUseCase(repo, plan),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide, PlanCheckService],
  },
  REVOKE_INVITE_USE_CASE: {
    provide: RevokeInviteUseCase,
    useFactory: (repo: IRepertoireRepository) => new RevokeInviteUseCase(repo),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide],
  },
  LIST_MY_INVITES_USE_CASE: {
    provide: ListMyInvitesUseCase,
    useFactory: (repo: IRepertoireRepository, mlRepo: IMusicLibraryRepository) =>
      new ListMyInvitesUseCase(repo, mlRepo),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide, "MusicLibraryRepository"],
  },
  CHECK_REPERTOIRE_SONG_ACCESS_USE_CASE: {
    provide: CheckRepertoireSongAccessUseCase,
    useFactory: (repo: IRepertoireRepository) => new CheckRepertoireSongAccessUseCase(repo),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide],
  },
  CHECK_SHARED_SONG_ACCESS_USE_CASE: {
    provide: CheckSharedSongAccessUseCase,
    useFactory: (repo: IRepertoireRepository) => new CheckSharedSongAccessUseCase(repo),
    inject: [REPOSITORIES.REPERTOIRE_REPOSITORY.provide],
  },
};

export const REPERTOIRE_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
};
