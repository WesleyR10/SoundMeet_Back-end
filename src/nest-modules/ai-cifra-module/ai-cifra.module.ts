import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { MusicLibraryModule } from "../music-library-module/music-library.module";
import { RabbitmqModule } from "../rabbitmq-module/rabbitmq.module";
import { SyncedLyricsModule } from "../synced-lyrics-module/synced-lyrics.module";
import {
  AiCifraAnalysisCompletedConsumer,
  AiCifraAnalysisFailedConsumer,
  AiCifraAnalysisProgressConsumer,
  AiCifraAnalysisRequestedConsumer,
} from "./ai-cifra.consumers";
import { AiCifraController } from "./ai-cifra.controller";
import { AI_CIFRA_PROVIDERS } from "./ai-cifra.providers";
import { AiCifraSearchController } from "./ai-cifra-search.controller";
import { AiCifraUploadsController } from "./ai-cifra-uploads.controller";

@Module({
  imports: [
    DatabaseModule,
    MusicLibraryModule,
    SyncedLyricsModule,
    ...((process.env.AI_CIFRA_PROCESSING_TRANSPORT ?? "http") === "rabbitmq"
      ? [RabbitmqModule.forFeature()]
      : []),
  ],
  controllers: [
    AiCifraController,
    AiCifraUploadsController,
    AiCifraSearchController,
  ],
  providers: [
    ...Object.values(AI_CIFRA_PROVIDERS.REPOSITORIES),
    ...Object.values(AI_CIFRA_PROVIDERS.INFRA_PROVIDERS),
    ...Object.values(AI_CIFRA_PROVIDERS.USE_CASES),
    ...Object.values(AI_CIFRA_PROVIDERS.JOBS),
    ...((process.env.AI_CIFRA_PROCESSING_TRANSPORT ?? "http") === "rabbitmq"
      ? [
          AiCifraAnalysisRequestedConsumer,
          AiCifraAnalysisProgressConsumer,
          AiCifraAnalysisCompletedConsumer,
          AiCifraAnalysisFailedConsumer,
        ]
      : []),
  ],
  exports: [
    AI_CIFRA_PROVIDERS.REPOSITORIES.AI_CIFRA_UPLOAD_REPOSITORY.provide,
    AI_CIFRA_PROVIDERS.REPOSITORIES.AI_CIFRA_ANALYSIS_JOB_REPOSITORY.provide,
    // Consumido pelo `ai-audio` no Modo Ensaio: a música da biblioteca não tem
    // áudio guardado (o ai-cifra apaga o objeto assim que a análise conclui),
    // então a separação precisa re-resolver a fonte pelo mesmo caminho. Exportar
    // o resolver evita duplicar a cadeia SimpMusic/yt-dlp → Musify/Piped num
    // segundo módulo — a regra do projeto é não duplicar lógica entre os três
    // módulos de IA.
    AI_CIFRA_PROVIDERS.USE_CASES.RESOLVE_AI_CIFRA_AUDIO_CANDIDATES_USE_CASE
      .provide,
  ],
})
export class AiCifraModule {}
