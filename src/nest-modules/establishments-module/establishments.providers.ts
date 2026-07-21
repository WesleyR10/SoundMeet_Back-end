import AWS from "aws-sdk";
import { ConfigService } from "@nestjs/config";

import { IDateTimeService } from "@core/shared/domain/date-time.service";
import { LuxonDateTimeService } from "@core/shared/infra/date-time/luxon-date-time.service";
import { IGeocodingService } from "@core/shared/domain/geocoding.service";
import { HttpGeocodingService } from "@core/shared/infra/geocoding/http-geocoding.service";
import { PlanCheckService } from "@core/plans/domain/plan-check.service";
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
import { UploadEstablishmentMenuPdfUseCase } from "../../core/establishment/application/use-cases/upload-establishment-menu-pdf/upload-establishment-menu-pdf.use-case";
import { DeleteEstablishmentMenuPdfUseCase } from "../../core/establishment/application/use-cases/delete-establishment-menu-pdf/delete-establishment-menu-pdf.use-case";
import { VerifyEstablishmentUseCase } from "../../core/establishment/application/use-cases/verify-establishment/verify-establishment.use-case";
import { IEstablishmentRepository } from "../../core/establishment/domain/establishment.repository";
import { IEstablishmentStorage } from "../../core/establishment/application/ports/establishment-storage.interface";
import { S3EstablishmentStorage } from "../../core/establishment/infra/storage/s3-establishment.storage";
import { IEstablishmentAnalyticsRepository } from "../../core/establishment/domain/establishment-analytics.repository";
import { DomainEventMediator } from "../../core/shared/domain/events/domain-event-mediator";
import { EstablishmentAnalyticsPrismaRepository } from "../../core/establishment/infra/db/prisma/establishment-analytics-prisma.repository";
import { EstablishmentPrismaRepository } from "../../core/establishment/infra/db/prisma/establishment-prisma.repository";
import { IBandRepository } from "../../core/musician/domain/band.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { EVENTS_PROVIDERS } from "../events-module/events.providers";
import { MUSICIANS_PROVIDERS } from "../musicians-module/musicians.providers";
import {
  BOOKING_LOOKUP_GATEWAY,
  EstablishmentAnalyticsEventsHandlers,
  PrismaBookingLookupGateway,
} from "./establishment-analytics-events.handlers";
import { RecalculateEstablishmentAnalyticsJob } from "./recalculate-establishment-analytics.job";

export const DATE_TIME_SERVICE_TOKEN = "DateTimeService";
export const GEOCODING_SERVICE_TOKEN = "GeocodingService";
export const ESTABLISHMENT_STORAGE_TOKEN = "EstablishmentStorage";

export const SERVICES = {
  DATE_TIME_SERVICE: {
    provide: DATE_TIME_SERVICE_TOKEN,
    useClass: LuxonDateTimeService,
  },
  // Geocodificacao best-effort (7.13c) usada pelo update de perfil — endereco
  // cadastrado (CEP) vira coordenadas pra busca por raio.
  GEOCODING_SERVICE: {
    provide: GEOCODING_SERVICE_TOKEN,
    useClass: HttpGeocodingService,
  },
};

export const STORAGE = {
  ESTABLISHMENT_STORAGE: {
    provide: ESTABLISHMENT_STORAGE_TOKEN,
    useFactory: (configService: ConfigService): IEstablishmentStorage => {
      const provider = configService.get<string>("ESTABLISHMENT_STORAGE_PROVIDER");
      const region = configService.get<string>("AWS_REGION") ?? "us-east-1";

      const r2Endpoint = configService.get<string>("CLOUDFLARE_R2_ENDPOINT");
      const r2AccessKey = configService.get<string>("CLOUDFLARE_R2_ACCESS_KEY_ID");
      const r2SecretKey = configService.get<string>("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
      const r2Bucket = configService.get<string>("CLOUDFLARE_R2_BUCKET");
      const r2PublicBaseUrl = configService.get<string>("CLOUDFLARE_R2_PUBLIC_BASE_URL") ?? null;

      if (provider === "cloudflare_r2") {
        const s3 = new AWS.S3({
          apiVersion: "2006-03-01",
          signatureVersion: "v4",
          region,
          endpoint: r2Endpoint,
          accessKeyId: r2AccessKey,
          secretAccessKey: r2SecretKey,
          s3ForcePathStyle: true,
        });
        return new S3EstablishmentStorage(s3, r2Bucket!, r2PublicBaseUrl);
      }

      const minioEndpoint = configService.get<string>("MINIO_ENDPOINT") ?? "localhost";
      const minioPort = configService.get<number>("MINIO_PORT") ?? 9000;
      const minioAccessKey = configService.get<string>("MINIO_ACCESS_KEY") ?? "soundmeet";
      const minioSecretKey = configService.get<string>("MINIO_SECRET_KEY") ?? "soundmeet123";
      const minioBucket = configService.get<string>("MINIO_BUCKET") ?? "soundmeet-media";
      const minioPublicEndpoint = configService.get<string>("MINIO_PUBLIC_ENDPOINT");
      const minioPublicPort = configService.get<number>("MINIO_PUBLIC_PORT");

      if (provider === "minio" || !provider) {
        const endpoint = `http://${minioEndpoint}:${minioPort}`;
        const s3 = new AWS.S3({
          apiVersion: "2006-03-01",
          signatureVersion: "v4",
          region,
          endpoint,
          accessKeyId: minioAccessKey,
          secretAccessKey: minioSecretKey,
          s3ForcePathStyle: true,
        });
        const publicBaseUrl =
          minioPublicEndpoint && minioPublicPort && minioBucket
            ? `http://${minioPublicEndpoint}:${minioPublicPort}/${minioBucket}`
            : null;
        return new S3EstablishmentStorage(s3, minioBucket, publicBaseUrl);
      }

      const awsBucket = configService.get<string>("AWS_S3_BUCKET") ?? "soundmeet-media";
      const cloudfrontUrl = configService.get<string>("AWS_CLOUDFRONT_URL") ?? null;
      const s3 = new AWS.S3({ apiVersion: "2006-03-01", signatureVersion: "v4", region });
      return new S3EstablishmentStorage(s3, awsBucket, cloudfrontUrl);
    },
    inject: [ConfigService],
  },
};

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
    useFactory: (repo: IEstablishmentRepository, planCheckService: PlanCheckService) => {
      return new CreateEstablishmentUseCase(repo, planCheckService);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide, PlanCheckService],
  },
  UPDATE_ESTABLISHMENT_USE_CASE: {
    provide: UpdateEstablishmentUseCase,
    useFactory: (
      repo: IEstablishmentRepository,
      domainEventMediator: DomainEventMediator,
    ) => {
      return new UpdateEstablishmentUseCase(repo, domainEventMediator);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide, DomainEventMediator],
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
    useFactory: (repo: IEstablishmentRepository, dateTimeService: IDateTimeService) => {
      return new GetEstablishmentUseCase(repo, dateTimeService);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide, DATE_TIME_SERVICE_TOKEN],
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
    useFactory: (repo: IEstablishmentRepository, dateTimeService: IDateTimeService) => {
      return new ListEstablishmentsUseCase(repo, dateTimeService);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide, DATE_TIME_SERVICE_TOKEN],
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
    useFactory: (
      repo: IEstablishmentRepository,
      geocodingService: IGeocodingService,
    ) => {
      return new UpdateEstablishmentProfileUseCase(repo, geocodingService);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide, GEOCODING_SERVICE_TOKEN],
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
  VERIFY_ESTABLISHMENT_USE_CASE: {
    provide: VerifyEstablishmentUseCase,
    useFactory: (repo: IEstablishmentRepository) => {
      return new VerifyEstablishmentUseCase(repo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  UPLOAD_ESTABLISHMENT_MENU_PDF_USE_CASE: {
    provide: UploadEstablishmentMenuPdfUseCase,
    useFactory: (
      repo: IEstablishmentRepository,
      storage: IEstablishmentStorage,
    ) => {
      return new UploadEstablishmentMenuPdfUseCase(repo, storage);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide, ESTABLISHMENT_STORAGE_TOKEN],
  },
  DELETE_ESTABLISHMENT_MENU_PDF_USE_CASE: {
    provide: DeleteEstablishmentMenuPdfUseCase,
    useFactory: (
      repo: IEstablishmentRepository,
      storage: IEstablishmentStorage,
    ) => {
      return new DeleteEstablishmentMenuPdfUseCase(repo, storage);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide, ESTABLISHMENT_STORAGE_TOKEN],
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

export const EVENTS = {
  DOMAIN_EVENT_MEDIATOR: {
    provide: DomainEventMediator,
    useFactory: (eventEmitter: EventEmitter2) => {
      return new DomainEventMediator(eventEmitter);
    },
    inject: [EventEmitter2],
  },
};

export const ESTABLISHMENTS_PROVIDERS = {
  REPOSITORIES,
  SERVICES,
  STORAGE,
  USE_CASES,
  EVENTS,
  HANDLERS,
  JOBS,
};
