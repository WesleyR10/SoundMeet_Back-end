import { CreateMusicLibraryUseCase } from "../../core/music-library/application/use-cases/create-music-library/create-music-library.use-case";
import { DeleteMusicLibraryUseCase } from "../../core/music-library/application/use-cases/delete-music-library/delete-music-library.use-case";
import { GetMusicLibraryUseCase } from "../../core/music-library/application/use-cases/get-music-library/get-music-library.use-case";
import { ListMusicLibraryUseCase } from "../../core/music-library/application/use-cases/list-music-library/list-music-library.use-case";
import { UpdateMusicLibraryUseCase } from "../../core/music-library/application/use-cases/update-music-library/update-music-library.use-case";
import { IMusicLibraryRepository } from "../../core/music-library/domain/music-library.repository";
import { MusicLibraryPrismaRepository } from "../../core/music-library/infra/db/prisma/music-library-prisma.repository";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { MusicLibraryCatalogService } from "./music-library.service";

export const REPOSITORIES = {
  MUSIC_LIBRARY_REPOSITORY: {
    provide: "MusicLibraryRepository",
    useExisting: MusicLibraryPrismaRepository,
  },
  MUSIC_LIBRARY_PRISMA_REPOSITORY: {
    provide: MusicLibraryPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new MusicLibraryPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const USE_CASES = {
  CREATE_MUSIC_LIBRARY_USE_CASE: {
    provide: CreateMusicLibraryUseCase,
    useFactory: (repo: IMusicLibraryRepository) => {
      return new CreateMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide],
  },
  GET_MUSIC_LIBRARY_USE_CASE: {
    provide: GetMusicLibraryUseCase,
    useFactory: (repo: IMusicLibraryRepository) => {
      return new GetMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide],
  },
  LIST_MUSIC_LIBRARY_USE_CASE: {
    provide: ListMusicLibraryUseCase,
    useFactory: (repo: IMusicLibraryRepository) => {
      return new ListMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide],
  },
  UPDATE_MUSIC_LIBRARY_USE_CASE: {
    provide: UpdateMusicLibraryUseCase,
    useFactory: (repo: IMusicLibraryRepository) => {
      return new UpdateMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide],
  },
  DELETE_MUSIC_LIBRARY_USE_CASE: {
    provide: DeleteMusicLibraryUseCase,
    useFactory: (repo: IMusicLibraryRepository) => {
      return new DeleteMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.MUSIC_LIBRARY_REPOSITORY.provide],
  },
};

export const SERVICES = {
  MUSIC_LIBRARY_CATALOG_SERVICE: {
    provide: MusicLibraryCatalogService,
    useFactory: (
      createUseCase: CreateMusicLibraryUseCase,
      getUseCase: GetMusicLibraryUseCase,
      listUseCase: ListMusicLibraryUseCase,
      updateUseCase: UpdateMusicLibraryUseCase,
    ) => {
      return new MusicLibraryCatalogService(
        createUseCase,
        getUseCase,
        listUseCase,
        updateUseCase,
      );
    },
    inject: [
      CreateMusicLibraryUseCase,
      GetMusicLibraryUseCase,
      ListMusicLibraryUseCase,
      UpdateMusicLibraryUseCase,
    ],
  },
};

export const MUSIC_LIBRARY_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
  SERVICES,
};
