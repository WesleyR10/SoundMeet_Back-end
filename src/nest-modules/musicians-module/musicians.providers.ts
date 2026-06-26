import { AddBandMemberUseCase } from "../../core/musician/application/use-cases/add-band-member/add-band-member.use-case";
import { CustomizeQRCodeUseCase } from "../../core/musician/application/use-cases/customize-qr-code/customize-qr-code.use-case";
import { GetMusicianAnalyticsUseCase } from "../../core/musician/application/use-cases/get-musician-analytics/get-musician-analytics.use-case";
import { VerifyMusicianUseCase } from "../../core/musician/application/use-cases/verify-musician/verify-musician.use-case";
import { CreateBandUseCase } from "../../core/musician/application/use-cases/create-band/create-band.use-case";
import { CreateMusicianUseCase } from "../../core/musician/application/use-cases/create-musician/create-musician.use-case";
import { DeleteBandUseCase } from "../../core/musician/application/use-cases/delete-band/delete-band.use-case";
import { DeleteMusicianUseCase } from "../../core/musician/application/use-cases/delete-musician/delete-musician.use-case";
import { GetBandUseCase } from "../../core/musician/application/use-cases/get-band/get-band.use-case";
import { GetMusicianUseCase } from "../../core/musician/application/use-cases/get-musician/get-musician.use-case";
import { ListBandsUseCase } from "../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import { ListMusiciansUseCase } from "../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { RemoveBandMemberUseCase } from "../../core/musician/application/use-cases/remove-band-member/remove-band-member.use-case";
import { UpdateBandUseCase } from "../../core/musician/application/use-cases/update-band/update-band.use-case";
import { UpdateMusicianUseCase } from "../../core/musician/application/use-cases/update-musician/update-musician.use-case";
import { UpdateMusicianProfileUseCase } from "../../core/musician/application/use-cases/update-musician-profile/update-musician-profile.use-case";
import { IBandRepository } from "../../core/musician/domain/band.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { PlanCheckService } from "../../core/plans/domain/plan-check.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
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
    useFactory: (
      musicianRepo: IMusicianRepository,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new UpdateMusicianUseCase(musicianRepo, domainEventMediator);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide, DomainEventMediator],
  },
  UPDATE_MUSICIAN_PROFILE_USE_CASE: {
    provide: UpdateMusicianProfileUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new UpdateMusicianProfileUseCase(musicianRepo);
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
  LIST_BANDS_USE_CASE: {
    provide: ListBandsUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new ListBandsUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  DELETE_BAND_USE_CASE: {
    provide: DeleteBandUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new DeleteBandUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  UPDATE_BAND_USE_CASE: {
    provide: UpdateBandUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new UpdateBandUseCase(bandRepo);
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
      planCheckService: PlanCheckService,
    ) => {
      return new AddBandMemberUseCase(bandRepo, musicianRepo, planCheckService);
    },
    inject: [
      REPOSITORIES.BAND_REPOSITORY.provide,
      REPOSITORIES.MUSICIAN_REPOSITORY.provide,
      PlanCheckService,
    ],
  },
  REMOVE_BAND_MEMBER_USE_CASE: {
    provide: RemoveBandMemberUseCase,
    useFactory: (bandRepo: IBandRepository) => {
      return new RemoveBandMemberUseCase(bandRepo);
    },
    inject: [REPOSITORIES.BAND_REPOSITORY.provide],
  },
  VERIFY_MUSICIAN_USE_CASE: {
    provide: VerifyMusicianUseCase,
    useFactory: (musicianRepo: IMusicianRepository) => {
      return new VerifyMusicianUseCase(musicianRepo);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide],
  },
  GET_MUSICIAN_ANALYTICS_USE_CASE: {
    provide: GetMusicianAnalyticsUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      planCheckService: PlanCheckService,
    ) => {
      return new GetMusicianAnalyticsUseCase(musicianRepo, planCheckService);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide, PlanCheckService],
  },
  CUSTOMIZE_QR_CODE_USE_CASE: {
    provide: CustomizeQRCodeUseCase,
    useFactory: (
      musicianRepo: IMusicianRepository,
      planCheckService: PlanCheckService,
    ) => {
      return new CustomizeQRCodeUseCase(musicianRepo, planCheckService);
    },
    inject: [REPOSITORIES.MUSICIAN_REPOSITORY.provide, PlanCheckService],
  },
};

export const EVENTS = {
  DOMAIN_EVENT_MEDIATOR: {
    provide: DomainEventMediator,
    useFactory: (eventEmitter: EventEmitter2) => {
      return new DomainEventMediator(eventEmitter);
    },
    inject: [EventEmitter2],
  },
};

export const MUSICIANS_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
  EVENTS,
};
