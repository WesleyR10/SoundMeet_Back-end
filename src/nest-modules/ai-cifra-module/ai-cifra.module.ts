import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { MusicLibraryModule } from "../music-library-module/music-library.module";
import { RabbitmqModule } from "../rabbitmq-module/rabbitmq.module";
import {
  AiCifraAnalysisCompletedConsumer,
  AiCifraAnalysisFailedConsumer,
  AiCifraAnalysisProgressConsumer,
  AiCifraAnalysisRequestedConsumer,
} from "./ai-cifra.consumers";
import { AiCifraController } from "./ai-cifra.controller";
import { AI_CIFRA_PROVIDERS } from "./ai-cifra.providers";
import { AiCifraUploadsController } from "./ai-cifra-uploads.controller";

@Module({
  imports: [
    DatabaseModule,
    MusicLibraryModule,
    ...((process.env.AI_CIFRA_PROCESSING_TRANSPORT ?? "http") === "rabbitmq"
      ? [RabbitmqModule.forFeature()]
      : []),
  ],
  controllers: [AiCifraController, AiCifraUploadsController],
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
  ],
})
export class AiCifraModule {}
