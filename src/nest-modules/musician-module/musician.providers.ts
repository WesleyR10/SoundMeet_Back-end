import { PrismaService } from "../database-module/prisma/prisma.service";
import { CreateMusicianUseCase } from "../../core/musician/application/use-cases/create-musician/create-musician.use-case";
import { UpdateMusicianUseCase } from "../../core/musician/application/use-cases/update-musician/update-musician.use-case";
import { ListMusiciansUseCase } from "../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { GetMusicianUseCase } from "../../core/musician/application/use-cases/get-musician/get-musician.use-case";
import { DeleteMusicianUseCase } from "../../core/musician/application/use-cases/delete-musician/delete-musician.use-case";
import { MusicianPrismaRepository } from "../../core/musician/infra/db/prisma/musician-prisma.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";

export const REPOSITORIES = {
  MUSICIAN_REPOSITORY: {
    provide: "MusicianRepository",
    useExisting: MusicianPrismaRepository,
  },
  MUSICIAN_PRISMA_REPOSITORY: {
    provide: MusicianPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new MusicianPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const USE_CASES = {
  CREATE_MUSICIAN_USE_CASE: {
    provide: CreateMusicianUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new CreateMusicianUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  UPDATE_MUSICIAN_USE_CASE: {
    provide: UpdateMusicianUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new UpdateMusicianUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  LIST_MUSICIANS_USE_CASE: {
    provide: ListMusiciansUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new ListMusiciansUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  GET_MUSICIAN_USE_CASE: {
    provide: GetMusicianUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new GetMusicianUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  DELETE_MUSICIAN_USE_CASE: {
    provide: DeleteMusicianUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new DeleteMusicianUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
};

export const VALIDATIONS = {
  // Adicionar validações específicas do domínio Musician aqui
};

export const MUSICIAN_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
  VALIDATIONS,
};
