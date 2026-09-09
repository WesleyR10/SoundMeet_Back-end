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
import { AuthGuard } from "./nest-modules/auth-module/auth.guard";
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
import { IndicationsModule } from "./nest-modules/indications-module/indications.module";
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
import { RedisThrottlerStorage } from "./nest-modules/shared-module/throttler/redis-throttler.storage";
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
      useFactory: (config: ConfigService<EnvConfig>) => {
        const throttlers = [
          {
            ttl: (config.get<number>("RATE_LIMIT_TTL") ?? 60) * 1000,
            limit: config.get<number>("RATE_LIMIT_MAX") ?? 100,
          },
        ];

        /*
         * Storage compartilhado em Redis para o limite valer em cluster (A3).
         * Fora dele o balde vive na memória de cada instância e o limite efetivo
         * é `limit × Nº de instâncias`. Em `test` fica em memória de propósito —
         * as suítes não sobem Redis e o storage padrão não depende dele; sem
         * `REDIS_URL` idem, para não quebrar dev offline. O storage é fail-open:
         * Redis fora do ar afrouxa o limite, nunca derruba o request.
         */
        const redisUrl = config.get<string>("REDIS_URL");
        const isTest = config.get<string>("NODE_ENV") === "test";
        if (isTest || !redisUrl) {
          return { throttlers };
        }

        return {
          throttlers,
          storage: new RedisThrottlerStorage(redisUrl),
        };
      },
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
    IndicationsModule,
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
   * A ORDEM DESTE ARRAY É A ORDEM DE EXECUÇÃO. Não reordenar sem ler abaixo.
   *
   * 1) `UserThrottlerGuard` no lugar do `ThrottlerGuard` padrão: o tracker passa
   *    a ser o `sub` do JWT, com fallback para IP em rota anônima. Sem isso, o
   *    `soundmeet-web` — onde todo tráfego sai do IP do BFF — compartilhava um
   *    único balde de RATE_LIMIT_MAX entre todos os operadores do painel. Ver o
   *    cabeçalho do guard.
   *
   * 2) `AuthGuard` global (AUTH-2): no Nest, **não autenticado é o default** —
   *    uma rota sem `@UseGuards(AuthGuard)` nasce pública, e esquecer o guard
   *    não quebra o build. Foi assim que `GET /synced-lyrics/search` virou proxy
   *    grátis da LRCLIB (SM-026). Com o guard global a omissão passa a falhar
   *    fechado: quem quiser rota anônima escreve `@Public()` de propósito.
   *    O guard trata `@Public()` com soft-auth — ver `auth.guard.ts`.
   *
   * 🔴 O throttler vem PRIMEIRO de propósito. Guards globais rodam na ordem de
   * registro; com o `AuthGuard` na frente, uma requisição com token inválido
   * levaria 401 **sem passar pelo rate limiter**, e tentativas com token forjado
   * deixariam de ser contadas — justamente o cenário de força bruta que o limite
   * existe para conter. O custo é uma verificação RSA a mais por request
   * autenticado (o throttler faz a sua, o AuthGuard faz a dele), explicado no
   * cabeçalho de `user-throttler.guard.ts`. É ruído perto de qualquer ida ao
   * banco, e inverter a ordem para economizá-la trocaria defesa por microssegundo.
   */
  providers: [
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
