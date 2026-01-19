import { IEventRepository } from "@core/events/domain";

import { CreateEstablishmentUseCase } from "../../core/establishment/application/use-cases/create-establishment/create-establishment.use-case";
import { CreateEstablishmentProfileUseCase } from "../../core/establishment/application/use-cases/create-establishment-profile/create-establishment-profile.use-case";
import { DeleteEstablishmentUseCase } from "../../core/establishment/application/use-cases/delete-establishment/delete-establishment.use-case";
import { DeleteEstablishmentProfileUseCase } from "../../core/establishment/application/use-cases/delete-establishment-profile/delete-establishment-profile.use-case";
import { GetEstablishmentUseCase } from "../../core/establishment/application/use-cases/get-establishment/get-establishment.use-case";
import { GetHiringDashboardUseCase } from "../../core/establishment/application/use-cases/get-hiring-dashboard/get-hiring-dashboard.use-case";
import { ListEstablishmentAnalyticsUseCase } from "../../core/establishment/application/use-cases/list-establishment-analytics/list-establishment-analytics.use-case";
import { ListEstablishmentsUseCase } from "../../core/establishment/application/use-cases/list-establishments/list-establishments.use-case";
import { RecalculateEstablishmentAnalyticsUseCase } from "../../core/establishment/application/use-cases/recalculate-establishment-analytics/recalculate-establishment-analytics.use-case";
import { UpdateEstablishmentUseCase } from "../../core/establishment/application/use-cases/update-establishment/update-establishment.use-case";
import { UpdateEstablishmentProfileUseCase } from "../../core/establishment/application/use-cases/update-establishment-profile/update-establishment-profile.use-case";
import { IEstablishmentRepository } from "../../core/establishment/domain/establishment.repository";
import { IEstablishmentAnalyticsRepository } from "../../core/establishment/domain/establishment-analytics.repository";
import { EstablishmentAnalyticsPrismaRepository } from "../../core/establishment/infra/db/prisma/establishment-analytics-prisma.repository";
import { EstablishmentPrismaRepository } from "../../core/establishment/infra/db/prisma/establishment-prisma.repository";
import { IBandRepository } from "../../core/musician/domain/band.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { EVENTS_PROVIDERS } from "../events-module/events.providers";
import { MUSICIANS_PROVIDERS } from "../musicians-module/musicians.providers";
import {
  BOOKING_LOOKUP_GATEWAY,
  EstablishmentAnalyticsEventsHandlers,
  PrismaBookingLookupGateway,
} from "./establishment-analytics-events.handlers";
import { RecalculateEstablishmentAnalyticsJob } from "./recalculate-establishment-analytics.job";

export const REPOSITORIES = {
  ESTABLISHMENT_REPOSITORY: {
    provide: "EstablishmentRepository",
    useExisting: EstablishmentPrismaRepository,
  },
  ESTABLISHMENT_PRISMA_REPOSITORY: {
    provide: EstablishmentPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new EstablishmentPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  ESTABLISHMENT_ANALYTICS_REPOSITORY: {
    provide: "EstablishmentAnalyticsRepository",
    useExisting: EstablishmentAnalyticsPrismaRepository,
  },
  ESTABLISHMENT_ANALYTICS_PRISMA_REPOSITORY: {
    provide: EstablishmentAnalyticsPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new EstablishmentAnalyticsPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const USE_CASES = {
  CREATE_ESTABLISHMENT_USE_CASE: {
    provide: CreateEstablishmentUseCase,
    useFactory: (repo: IEstablishmentRepository) => {
      return new CreateEstablishmentUseCase(repo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  UPDATE_ESTABLISHMENT_USE_CASE: {
    provide: UpdateEstablishmentUseCase,
    useFactory: (repo: IEstablishmentRepository) => {
      return new UpdateEstablishmentUseCase(repo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  DELETE_ESTABLISHMENT_USE_CASE: {
    provide: DeleteEstablishmentUseCase,
    useFactory: (repo: IEstablishmentRepository) => {
      return new DeleteEstablishmentUseCase(repo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  GET_ESTABLISHMENT_USE_CASE: {
    provide: GetEstablishmentUseCase,
    useFactory: (repo: IEstablishmentRepository) => {
      return new GetEstablishmentUseCase(repo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  GET_HIRING_DASHBOARD_USE_CASE: {
    provide: GetHiringDashboardUseCase,
    useFactory: (
      establishmentRepo: IEstablishmentRepository,
      musicianRepo: IMusicianRepository,
      bandRepo: IBandRepository,
      eventRepo: IEventRepository,
    ) => {
      return new GetHiringDashboardUseCase(
        establishmentRepo,
        musicianRepo,
        bandRepo,
        eventRepo,
      );
    },
    inject: [
      REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide,
      MUSICIANS_PROVIDERS.REPOSITORIES.MUSICIAN_REPOSITORY.provide,
      MUSICIANS_PROVIDERS.REPOSITORIES.BAND_REPOSITORY.provide,
      EVENTS_PROVIDERS.REPOSITORIES.EVENT_REPOSITORY.provide,
    ],
  },
  LIST_ESTABLISHMENTS_USE_CASE: {
    provide: ListEstablishmentsUseCase,
    useFactory: (repo: IEstablishmentRepository) => {
      return new ListEstablishmentsUseCase(repo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  LIST_ESTABLISHMENT_ANALYTICS_USE_CASE: {
    provide: ListEstablishmentAnalyticsUseCase,
    useFactory: (repo: IEstablishmentAnalyticsRepository) => {
      return new ListEstablishmentAnalyticsUseCase(repo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_ANALYTICS_REPOSITORY.provide],
  },
  CREATE_ESTABLISHMENT_PROFILE_USE_CASE: {
    provide: CreateEstablishmentProfileUseCase,
    useFactory: (repo: IEstablishmentRepository) => {
      return new CreateEstablishmentProfileUseCase(repo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  UPDATE_ESTABLISHMENT_PROFILE_USE_CASE: {
    provide: UpdateEstablishmentProfileUseCase,
    useFactory: (repo: IEstablishmentRepository) => {
      return new UpdateEstablishmentProfileUseCase(repo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  DELETE_ESTABLISHMENT_PROFILE_USE_CASE: {
    provide: DeleteEstablishmentProfileUseCase,
    useFactory: (repo: IEstablishmentRepository) => {
      return new DeleteEstablishmentProfileUseCase(repo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  RECALCULATE_ESTABLISHMENT_ANALYTICS_USE_CASE: {
    provide: RecalculateEstablishmentAnalyticsUseCase,
    useFactory: (
      establishmentRepo: IEstablishmentRepository,
      analyticsRepo: IEstablishmentAnalyticsRepository,
    ) => {
      return new RecalculateEstablishmentAnalyticsUseCase(
        establishmentRepo,
        analyticsRepo,
      );
    },
    inject: [
      REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide,
      REPOSITORIES.ESTABLISHMENT_ANALYTICS_REPOSITORY.provide,
    ],
  },
};

export const HANDLERS = {
  ESTABLISHMENT_ANALYTICS_EVENTS_HANDLERS: {
    provide: EstablishmentAnalyticsEventsHandlers,
    useClass: EstablishmentAnalyticsEventsHandlers,
  },
  BOOKING_LOOKUP_GATEWAY: {
    provide: BOOKING_LOOKUP_GATEWAY,
    useClass: PrismaBookingLookupGateway,
  },
};

export const JOBS = {
  RECALCULATE_ESTABLISHMENT_ANALYTICS_JOB: {
    provide: RecalculateEstablishmentAnalyticsJob,
    useClass: RecalculateEstablishmentAnalyticsJob,
  },
};

export const ESTABLISHMENTS_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
  HANDLERS,
  JOBS,
};
