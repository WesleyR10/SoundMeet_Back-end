import { AddBandMemberUseCase } from "../../core/musician/application/use-cases/add-band-member/add-band-member.use-case";
import { CreateBandUseCase } from "../../core/musician/application/use-cases/create-band/create-band.use-case";
import { CreateMusicianUseCase } from "../../core/musician/application/use-cases/create-musician/create-musician.use-case";
import { DeleteMusicianUseCase } from "../../core/musician/application/use-cases/delete-musician/delete-musician.use-case";
import { GetBandUseCase } from "../../core/musician/application/use-cases/get-band/get-band.use-case";
import { GetMusicianUseCase } from "../../core/musician/application/use-cases/get-musician/get-musician.use-case";
import { ListMusiciansUseCase } from "../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { RemoveBandMemberUseCase } from "../../core/musician/application/use-cases/remove-band-member/remove-band-member.use-case";
import { UpdateMusicianUseCase } from "../../core/musician/application/use-cases/update-musician/update-musician.use-case";
import { IBandRepository } from "../../core/musician/domain/band.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { BandPrismaRepository } from "../../core/musician/infra/db/prisma/band-prisma.repository";
import { MusicianPrismaRepository } from "../../core/musician/infra/db/prisma/musician-prisma.repository";
import { PrismaService } from "../database-module/prisma/prisma.service";

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
  BAND_REPOSITORY: {
    provide: "BandRepository",
    useExisting: BandPrismaRepository,
  },
  BAND_PRISMA_REPOSITORY: {
    provide: BandPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new BandPrismaRepository(prismaService);
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
  CREATE_BAND_USE_CASE: {
    provide: CreateBandUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new CreateBandUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  GET_BAND_USE_CASE: {
    provide: GetBandUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new GetBandUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  ADD_BAND_MEMBER_USE_CASE: {
    provide: AddBandMemberUseCase,
    useFactory: (
      bandRepo: IBandRepository,
      musicianRepo: IMusicianRepository,
    ) => {
      return new AddBandMemberUseCase(bandRepo, musicianRepo);
    },
    inject: [
      REPOSITORIES.BAND_REPOSITORY.provide,
      REPOSITORIES.MUSICIAN_REPOSITORY.provide,
    ],
  },
  REMOVE_BAND_MEMBER_USE_CASE: {
    provide: RemoveBandMemberUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new RemoveBandMemberUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
};

export const MUSICIANS_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
};
