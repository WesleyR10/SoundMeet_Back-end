import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { RabbitmqModule } from "../rabbitmq-module/rabbitmq.module";
import { SyncedLyricsBulkRequestedConsumer } from "./synced-lyrics.consumers";
import { SyncedLyricsController } from "./synced-lyrics.controller";
import { SYNCED_LYRICS_PROVIDERS } from "./synced-lyrics.providers";
import { SyncedLyricsLrclibController } from "./synced-lyrics-lrclib.controller";
import { SyncedLyricsRateLimitGuard } from "./synced-lyrics-rate-limit.guard";

@Module({
  imports: [
    DatabaseModule,
    ...((process.env.SYNCED_LYRICS_BULK_TRANSPORT ?? "inline") === "rabbitmq"
      ? [RabbitmqModule.forFeature()]
      : []),
  ],
  controllers: [SyncedLyricsController, SyncedLyricsLrclibController],
  providers: [
    ...Object.values(SYNCED_LYRICS_PROVIDERS.REPOSITORIES),
    ...Object.values(SYNCED_LYRICS_PROVIDERS.INFRA_PROVIDERS),
    ...Object.values(SYNCED_LYRICS_PROVIDERS.USE_CASES),
    SyncedLyricsRateLimitGuard,
    ...((process.env.SYNCED_LYRICS_BULK_TRANSPORT ?? "inline") === "rabbitmq"
      ? [SyncedLyricsBulkRequestedConsumer]
      : []),
  ],
  exports: [
    SYNCED_LYRICS_PROVIDERS.REPOSITORIES.SYNCED_LYRICS_REPOSITORY.provide,
    SYNCED_LYRICS_PROVIDERS.USE_CASES.GET_CHORD_SHEET_FOR_MUSIC_LIBRARY_USE_CASE.provide,
    // Consumido por ai-cifra-module (Process/CompleteAiCifraAnalysisJobUseCase)
    // -- ver Docs/AI-musician/chord-sheet.md "Alinhamento forçado (MMS_FA)".
    SYNCED_LYRICS_PROVIDERS.USE_CASES.ALIGN_SYNCED_LYRICS_WORD_TIMESTAMPS_USE_CASE.provide,
  ],
})
export class SyncedLyricsModule {}
