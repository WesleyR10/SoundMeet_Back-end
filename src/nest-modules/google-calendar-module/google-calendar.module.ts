import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { GoogleCalendarController } from "./google-calendar.controller";
import { GOOGLE_CALENDAR_PROVIDERS } from "./google-calendar.providers";
import { GoogleCalendarCallbackController } from "./google-calendar-callback.controller";

/**
 * Integração Google Calendar — capacidade de perfil do músico (conectar a
 * própria agenda), com sync assíncrono de bookings via RabbitMQ.
 *
 * Não importa SchedulingModule (evita ciclo): os eventos de booking chegam
 * cross-module via EventEmitter2 (`GoogleCalendarSyncEventsHandler`) e os
 * repositórios de outros contextos são declarados localmente via PrismaService.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [GoogleCalendarController, GoogleCalendarCallbackController],
  providers: [
    ...Object.values(GOOGLE_CALENDAR_PROVIDERS.REPOSITORIES),
    ...Object.values(GOOGLE_CALENDAR_PROVIDERS.INFRA_PROVIDERS),
    ...Object.values(GOOGLE_CALENDAR_PROVIDERS.SERVICES),
    ...Object.values(GOOGLE_CALENDAR_PROVIDERS.USE_CASES),
    ...Object.values(GOOGLE_CALENDAR_PROVIDERS.HANDLERS),
    ...Object.values(GOOGLE_CALENDAR_PROVIDERS.CONSUMERS),
  ],
})
export class GoogleCalendarModule {}
