import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import { randomBytes } from "crypto";

import { IEstablishmentRepository } from "../../core/establishment/domain/establishment.repository";
import { EstablishmentPrismaRepository } from "../../core/establishment/infra/db/prisma/establishment-prisma.repository";
import { IGoogleCalendarGateway } from "../../core/google-calendar/application/ports/google-calendar-gateway.interface";
import { IGoogleCalendarSyncDispatcher } from "../../core/google-calendar/application/ports/google-calendar-sync-dispatcher.interface";
import { GoogleCalendarTokenService } from "../../core/google-calendar/application/services/google-calendar-token.service";
import { ConnectGoogleCalendarUseCase } from "../../core/google-calendar/application/use-cases/connect-google-calendar/connect-google-calendar.use-case";
import { DisconnectGoogleCalendarUseCase } from "../../core/google-calendar/application/use-cases/disconnect-google-calendar/disconnect-google-calendar.use-case";
import { GetGoogleCalendarStatusUseCase } from "../../core/google-calendar/application/use-cases/get-google-calendar-status/get-google-calendar-status.use-case";
import { SyncBookingCancelledToGoogleCalendarUseCase } from "../../core/google-calendar/application/use-cases/sync-booking-cancelled/sync-booking-cancelled.use-case";
import { SyncBookingConfirmedToGoogleCalendarUseCase } from "../../core/google-calendar/application/use-cases/sync-booking-confirmed/sync-booking-confirmed.use-case";
import { IGoogleCalendarIntegrationRepository } from "../../core/google-calendar/domain/google-calendar-integration.repository";
import { IGoogleCalendarSyncedEventRepository } from "../../core/google-calendar/domain/google-calendar-synced-event.repository";
import { GoogleCalendarIntegrationPrismaRepository } from "../../core/google-calendar/infra/db/prisma/google-calendar-integration-prisma.repository";
import { GoogleCalendarSyncedEventPrismaRepository } from "../../core/google-calendar/infra/db/prisma/google-calendar-synced-event-prisma.repository";
import { GoogleCalendarHttpClient } from "../../core/google-calendar/infra/http/google-calendar-http.client";
import { IBandRepository } from "../../core/musician/domain/band.repository";
import { BandPrismaRepository } from "../../core/musician/infra/db/prisma/band-prisma.repository";
import { IBookingRepository } from "../../core/scheduling/domain/booking.repository";
import { BookingPrismaRepository } from "../../core/scheduling/infra/db/prisma/booking-prisma.repository";
import { IEncryptionService } from "../../core/shared/domain/encryption.service";
import { AesGcmEncryptionService } from "../../core/shared/infra/crypto/aes-gcm-encryption.service";
import { ConfigSchemaType } from "../config-module/config.schema";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { GoogleCalendarOAuthStateService } from "./google-calendar-oauth-state.service";
import { GoogleCalendarSyncConsumers } from "./google-calendar-sync.consumers";
import {
  GoogleCalendarSyncNoopDispatcher,
  GoogleCalendarSyncRabbitmqDispatcher,
} from "./google-calendar-sync.dispatcher";
import { GoogleCalendarSyncEventsHandler } from "./google-calendar-sync-events.handler";

export const REPOSITORIES = {
  GOOGLE_CALENDAR_INTEGRATION_REPOSITORY: {
    provide: "GoogleCalendarIntegrationRepository",
    useExisting: GoogleCalendarIntegrationPrismaRepository,
  },
  GOOGLE_CALENDAR_INTEGRATION_PRISMA_REPOSITORY: {
    provide: GoogleCalendarIntegrationPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new GoogleCalendarIntegrationPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  GOOGLE_CALENDAR_SYNCED_EVENT_REPOSITORY: {
    provide: "GoogleCalendarSyncedEventRepository",
    useExisting: GoogleCalendarSyncedEventPrismaRepository,
  },
  GOOGLE_CALENDAR_SYNCED_EVENT_PRISMA_REPOSITORY: {
    provide: GoogleCalendarSyncedEventPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new GoogleCalendarSyncedEventPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  // Repositórios de outros contextos declarados localmente via PrismaService
  // (mesmo precedente do scheduling.providers com BAND_*) — evita importar
  // SchedulingModule e criar ciclo de módulos.
  BOOKING_REPOSITORY: {
    provide: "BookingRepository",
    useFactory: (prismaService: PrismaService) => {
      return new BookingPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  BAND_REPOSITORY: {
    provide: "BandRepository",
    useFactory: (prismaService: PrismaService) => {
      return new BandPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  ESTABLISHMENT_REPOSITORY: {
    provide: "EstablishmentRepository",
    useFactory: (prismaService: PrismaService) => {
      return new EstablishmentPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const INFRA_PROVIDERS = {
  ENCRYPTION_SERVICE: {
    provide: "EncryptionService",
    useFactory: (configService: ConfigSchemaType): IEncryptionService => {
      const key = configService.get<string>("TOKEN_ENCRYPTION_KEY");
      if (key && key.trim()) {
        return new AesGcmEncryptionService(key);
      }
      // Joi exige a chave em produção — aqui só dev/test chegam sem ela.
      // Chave efêmera: tokens cifrados não sobrevivem a restart (aceitável
      // em dev; NUNCA acontece em produção).
      new Logger("GoogleCalendarModule").warn(
        "TOKEN_ENCRYPTION_KEY ausente — usando chave efêmera de desenvolvimento (tokens não sobrevivem a restart)",
      );
      return new AesGcmEncryptionService(randomBytes(32).toString("base64"));
    },
    inject: [ConfigService],
  },
  GOOGLE_CALENDAR_GATEWAY: {
    provide: "GoogleCalendarGateway",
    useFactory: (configService: ConfigSchemaType): IGoogleCalendarGateway => {
      return GoogleCalendarHttpClient.create({
        clientId: configService.get<string>("GOOGLE_CALENDAR_CLIENT_ID") ?? "",
        clientSecret:
          configService.get<string>("GOOGLE_CALENDAR_CLIENT_SECRET") ?? "",
      });
    },
    inject: [ConfigService],
  },
  GOOGLE_CALENDAR_SYNC_DISPATCHER: {
    provide: "GoogleCalendarSyncDispatcher",
    useFactory: (
      moduleRef: ModuleRef,
      configService: ConfigSchemaType,
    ): IGoogleCalendarSyncDispatcher => {
      const transport =
        configService.get<string>("GOOGLE_CALENDAR_SYNC_TRANSPORT") ?? "noop";
      if (transport !== "rabbitmq") {
        return new GoogleCalendarSyncNoopDispatcher();
      }
      const amqpConnection = moduleRef.get(AmqpConnection, { strict: false });
      if (!amqpConnection) {
        return new GoogleCalendarSyncNoopDispatcher();
      }
      return new GoogleCalendarSyncRabbitmqDispatcher(amqpConnection);
    },
    inject: [ModuleRef, ConfigService],
  },
};

export const SERVICES = {
  OAUTH_STATE_SERVICE: {
    provide: GoogleCalendarOAuthStateService,
    useFactory: (configService: ConfigSchemaType) => {
      return new GoogleCalendarOAuthStateService(
        configService.get<string>("JWT_SECRET")!,
      );
    },
    inject: [ConfigService],
  },
  TOKEN_SERVICE: {
    provide: GoogleCalendarTokenService,
    useFactory: (
      integrationRepo: IGoogleCalendarIntegrationRepository,
      gateway: IGoogleCalendarGateway,
      encryption: IEncryptionService,
    ) => {
      return new GoogleCalendarTokenService(
        integrationRepo,
        gateway,
        encryption,
      );
    },
    inject: [
      REPOSITORIES.GOOGLE_CALENDAR_INTEGRATION_REPOSITORY.provide,
      INFRA_PROVIDERS.GOOGLE_CALENDAR_GATEWAY.provide,
      INFRA_PROVIDERS.ENCRYPTION_SERVICE.provide,
    ],
  },
};

export const USE_CASES = {
  CONNECT_GOOGLE_CALENDAR_USE_CASE: {
    provide: ConnectGoogleCalendarUseCase,
    useFactory: (
      integrationRepo: IGoogleCalendarIntegrationRepository,
      gateway: IGoogleCalendarGateway,
      encryption: IEncryptionService,
    ) => {
      return new ConnectGoogleCalendarUseCase(
        integrationRepo,
        gateway,
        encryption,
      );
    },
    inject: [
      REPOSITORIES.GOOGLE_CALENDAR_INTEGRATION_REPOSITORY.provide,
      INFRA_PROVIDERS.GOOGLE_CALENDAR_GATEWAY.provide,
      INFRA_PROVIDERS.ENCRYPTION_SERVICE.provide,
    ],
  },
  GET_GOOGLE_CALENDAR_STATUS_USE_CASE: {
    provide: GetGoogleCalendarStatusUseCase,
    useFactory: (integrationRepo: IGoogleCalendarIntegrationRepository) => {
      return new GetGoogleCalendarStatusUseCase(integrationRepo);
    },
    inject: [REPOSITORIES.GOOGLE_CALENDAR_INTEGRATION_REPOSITORY.provide],
  },
  DISCONNECT_GOOGLE_CALENDAR_USE_CASE: {
    provide: DisconnectGoogleCalendarUseCase,
    useFactory: (
      integrationRepo: IGoogleCalendarIntegrationRepository,
      gateway: IGoogleCalendarGateway,
      encryption: IEncryptionService,
    ) => {
      return new DisconnectGoogleCalendarUseCase(
        integrationRepo,
        gateway,
        encryption,
      );
    },
    inject: [
      REPOSITORIES.GOOGLE_CALENDAR_INTEGRATION_REPOSITORY.provide,
      INFRA_PROVIDERS.GOOGLE_CALENDAR_GATEWAY.provide,
      INFRA_PROVIDERS.ENCRYPTION_SERVICE.provide,
    ],
  },
  SYNC_BOOKING_CONFIRMED_USE_CASE: {
    provide: SyncBookingConfirmedToGoogleCalendarUseCase,
    useFactory: (
      bookingRepo: IBookingRepository,
      bandRepo: IBandRepository,
      integrationRepo: IGoogleCalendarIntegrationRepository,
      syncedEventRepo: IGoogleCalendarSyncedEventRepository,
      gateway: IGoogleCalendarGateway,
      tokenService: GoogleCalendarTokenService,
      establishmentRepo: IEstablishmentRepository,
    ) => {
      return new SyncBookingConfirmedToGoogleCalendarUseCase(
        bookingRepo,
        bandRepo,
        integrationRepo,
        syncedEventRepo,
        gateway,
        tokenService,
        establishmentRepo,
      );
    },
    inject: [
      REPOSITORIES.BOOKING_REPOSITORY.provide,
      REPOSITORIES.BAND_REPOSITORY.provide,
      REPOSITORIES.GOOGLE_CALENDAR_INTEGRATION_REPOSITORY.provide,
      REPOSITORIES.GOOGLE_CALENDAR_SYNCED_EVENT_REPOSITORY.provide,
      INFRA_PROVIDERS.GOOGLE_CALENDAR_GATEWAY.provide,
      GoogleCalendarTokenService,
      REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide,
    ],
  },
  SYNC_BOOKING_CANCELLED_USE_CASE: {
    provide: SyncBookingCancelledToGoogleCalendarUseCase,
    useFactory: (
      integrationRepo: IGoogleCalendarIntegrationRepository,
      syncedEventRepo: IGoogleCalendarSyncedEventRepository,
      gateway: IGoogleCalendarGateway,
      tokenService: GoogleCalendarTokenService,
    ) => {
      return new SyncBookingCancelledToGoogleCalendarUseCase(
        integrationRepo,
        syncedEventRepo,
        gateway,
        tokenService,
      );
    },
    inject: [
      REPOSITORIES.GOOGLE_CALENDAR_INTEGRATION_REPOSITORY.provide,
      REPOSITORIES.GOOGLE_CALENDAR_SYNCED_EVENT_REPOSITORY.provide,
      INFRA_PROVIDERS.GOOGLE_CALENDAR_GATEWAY.provide,
      GoogleCalendarTokenService,
    ],
  },
};

export const HANDLERS = {
  GOOGLE_CALENDAR_SYNC_EVENTS_HANDLER: {
    provide: GoogleCalendarSyncEventsHandler,
    useClass: GoogleCalendarSyncEventsHandler,
  },
};

export const CONSUMERS = {
  GOOGLE_CALENDAR_SYNC_CONSUMERS: {
    provide: GoogleCalendarSyncConsumers,
    useClass: GoogleCalendarSyncConsumers,
  },
};

export const GOOGLE_CALENDAR_PROVIDERS = {
  REPOSITORIES,
  INFRA_PROVIDERS,
  SERVICES,
  USE_CASES,
  HANDLERS,
  CONSUMERS,
};
