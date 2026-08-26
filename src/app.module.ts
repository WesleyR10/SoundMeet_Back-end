import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { SentryModule } from "@sentry/nestjs/setup";

import { HealthController } from "./health.controller";
import { AiAudioModule } from "./nest-modules/ai-audio-module/ai-audio.module";
import { AiCifraModule } from "./nest-modules/ai-cifra-module/ai-cifra.module";
import { AudiencesModule } from "./nest-modules/audiences-module/audiences.module";
import { AuthModule } from "./nest-modules/auth-module/auth.module";
import { CampaignModule } from "./nest-modules/campaign-module/campaign.module";
import { ChatModule } from "./nest-modules/chat-module/chat.module";
import {
  ConfigSchemaType,
  EnvConfig,
} from "./nest-modules/config-module/config.schema";
import { ConfigModuleRoot } from "./nest-modules/config-module/config-module.module";
import { ContractModule } from "./nest-modules/contract-module/contract.module";
import { DatabaseModule } from "./nest-modules/database-module/database.module";
import { EstablishmentsModule } from "./nest-modules/establishments-module/establishments.module";
import { EventModule } from "./nest-modules/events-module/events.module";
import { GamificationModule } from "./nest-modules/gamification-module/gamification.module";
import { GoogleCalendarModule } from "./nest-modules/google-calendar-module/google-calendar.module";
import { MailModule } from "./nest-modules/mail-module/mail.module";
import { MusicLibraryModule } from "./nest-modules/music-library-module/music-library.module";
import { MusicianAnalyticsModule } from "./nest-modules/musician-analytics-module/musician-analytics.module";
import { MusiciansModule } from "./nest-modules/musicians-module/musicians.module";
import { NotificationsModule } from "./nest-modules/notifications-module/notifications.module";
import { PaymentModule } from "./nest-modules/payment-module/payment.module";
import { PerformanceModule } from "./nest-modules/performance-module/performance.module";
import { PersonalChordSheetModule } from "./nest-modules/personal-chord-sheet-module/personal-chord-sheet.module";
import { PlansModule } from "./nest-modules/plans-module/plans.module";
import { RabbitmqModule } from "./nest-modules/rabbitmq-module/rabbitmq.module";
import { RepertoireModule } from "./nest-modules/repertoire-module/repertoire.module";
import { RequestsModule } from "./nest-modules/requests-module/requests.module";
import { ReviewsModule } from "./nest-modules/reviews-module/reviews.module";
import { SchedulingModule } from "./nest-modules/scheduling-module/scheduling.module";
import { UserThrottlerGuard } from "./nest-modules/shared-module/guards/user-throttler.guard";
import { SyncedLyricsModule } from "./nest-modules/synced-lyrics-module/synced-lyrics.module";

const normalizeTransport = (value: string | undefined, fallback: string) =>
  (value ?? fallback).trim().toLowerCase();

const shouldRegisterRabbitmqHandlers =
  normalizeTransport(process.env.AI_AUDIO_PROCESSING_TRANSPORT, "http") ===
    "rabbitmq" ||
  normalizeTransport(process.env.AI_CIFRA_PROCESSING_TRANSPORT, "http") ===
    "rabbitmq" ||
  normalizeTransport(process.env.SYNCED_LYRICS_BULK_TRANSPORT, "inline") ===
    "rabbitmq" ||
  normalizeTransport(
    process.env.GAMIFICATION_PROCESSING_TRANSPORT,
    "inline",
  ) === "rabbitmq" ||
  normalizeTransport(process.env.GOOGLE_CALENDAR_SYNC_TRANSPORT, "noop") ===
    "rabbitmq";

@Module({
  imports: [
    // Primeiro import — enriquece requests/exceptions capturados pelo Sentry
    // com contexto do NestJS (handler, controller, rota).
    SentryModule.forRoot(),
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
    PlansModule,
    MusicianAnalyticsModule,
    CampaignModule,
    RepertoireModule,
    ReviewsModule,
    PerformanceModule,
    ContractModule,
    PersonalChordSheetModule,
    AiAudioModule,
    AiCifraModule,
    SyncedLyricsModule,
    NotificationsModule,
    ChatModule,
    GoogleCalendarModule,

    // Event System
    // messaging-module

    // Scheduler
    ScheduleModule.forRoot(),

    // Infrastructure
    // Domain modules removed
  ],
  controllers: [HealthController],
  /*
   * `UserThrottlerGuard` no lugar do `ThrottlerGuard` padrão: o tracker passa a
   * ser o `sub` do JWT, com fallback para IP em rota anônima. Sem isso, o
   * `soundmeet-web` — onde todo tráfego sai do IP do BFF — compartilhava um
   * único balde de RATE_LIMIT_MAX entre todos os operadores do painel. Ver o
   * cabeçalho do guard.
   */
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class AppModule {}
