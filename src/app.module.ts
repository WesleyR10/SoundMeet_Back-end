import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";

import { HealthController } from "./health.controller";
import {
  ConfigSchemaType,
  EnvConfig,
} from "./nest-modules/config-module/config.schema";
import { AiAudioModule } from "./nest-modules/ai-audio-module/ai-audio.module";
import { AiCifraModule } from "./nest-modules/ai-cifra-module/ai-cifra.module";
import { AudiencesModule } from "./nest-modules/audiences-module/audiences.module";
import { AuthModule } from "./nest-modules/auth-module/auth.module";
import { ConfigModuleRoot } from "./nest-modules/config-module/config-module.module";
import { DatabaseModule } from "./nest-modules/database-module/database.module";
import { EstablishmentsModule } from "./nest-modules/establishments-module/establishments.module";
import { EventModule } from "./nest-modules/events-module/events.module";
import { GamificationModule } from "./nest-modules/gamification-module/gamification.module";
import { MusicLibraryModule } from "./nest-modules/music-library-module/music-library.module";
import { MusiciansModule } from "./nest-modules/musicians-module/musicians.module";
import { PaymentModule } from "./nest-modules/payment-module/payment.module";
import { RabbitmqModule } from "./nest-modules/rabbitmq-module/rabbitmq.module";
import { RequestsModule } from "./nest-modules/requests-module/requests.module";
import { SchedulingModule } from "./nest-modules/scheduling-module/scheduling.module";
import { SyncedLyricsModule } from "./nest-modules/synced-lyrics-module/synced-lyrics.module";
import { MailModule } from "./nest-modules/mail-module/mail.module";
import { CampaignModule } from "./nest-modules/campaign-module/campaign.module";

const normalizeTransport = (value: string | undefined, fallback: string) =>
  (value ?? fallback).trim().toLowerCase();

const shouldRegisterRabbitmqHandlers =
  normalizeTransport(process.env.AI_AUDIO_PROCESSING_TRANSPORT, "http") ===
    "rabbitmq" ||
  normalizeTransport(process.env.AI_CIFRA_PROCESSING_TRANSPORT, "http") ===
    "rabbitmq" ||
  normalizeTransport(process.env.SYNCED_LYRICS_BULK_TRANSPORT, "inline") ===
    "rabbitmq";

@Module({
  imports: [
    ConfigModuleRoot.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => [
        {
          ttl: (config.get<number>("RATE_LIMIT_TTL") ?? 60) * 1000,
          limit: config.get<number>("RATE_LIMIT_MAX") ?? 100,
        },
      ],
    }),
    RabbitmqModule.forRoot({ enableConsumers: shouldRegisterRabbitmqHandlers }),

    // Module
    MailModule,
    AuthModule,
    DatabaseModule,
    MusiciansModule,
    EstablishmentsModule,
    AudiencesModule,
    RequestsModule,
    EventModule,
    SchedulingModule,
    GamificationModule,
    MusicLibraryModule,
    PaymentModule,
    CampaignModule,
    AiAudioModule,
    AiCifraModule,
    SyncedLyricsModule,

    // Event System
    // messaging-module

    // Scheduler
    ScheduleModule.forRoot(),

    // Infrastructure
    // Domain modules removed
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
