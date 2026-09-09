import { Module } from "@nestjs/common";

import { AiCifraModule } from "../ai-cifra-module/ai-cifra.module";
import { DatabaseModule } from "../database-module/database.module";
import { MusicLibraryModule } from "../music-library-module/music-library.module";
import { RabbitmqModule } from "../rabbitmq-module/rabbitmq.module";
import {
  AiAudioSeparationCompletedConsumer,
  AiAudioSeparationFailedConsumer,
  AiAudioSeparationRequestedConsumer,
} from "./ai-audio.consumers";
import { AiAudioController } from "./ai-audio.controller";
import { AI_AUDIO_PROVIDERS } from "./ai-audio.providers";
import { AiAudioUploadsController } from "./ai-audio-uploads.controller";
import { PracticeSeparationController } from "./practice-separation.controller";

@Module({
  imports: [
    DatabaseModule,
    // Modo Ensaio: a música da biblioteca não tem áudio guardado (o ai-cifra
    // apaga o objeto assim que a análise conclui), então a separação
    // re-resolve a fonte pelo resolver do ai-cifra em vez de duplicar a cadeia
    // SimpMusic/yt-dlp → Musify/Piped aqui.
    AiCifraModule,
    MusicLibraryModule,
    ...((process.env.AI_AUDIO_PROCESSING_TRANSPORT ?? "http") === "rabbitmq"
      ? [RabbitmqModule.forFeature()]
      : []),
  ],
  controllers: [
    AiAudioController,
    AiAudioUploadsController,
    PracticeSeparationController,
  ],
  providers: [
    ...Object.values(AI_AUDIO_PROVIDERS.REPOSITORIES),
    ...Object.values(AI_AUDIO_PROVIDERS.INFRA_PROVIDERS),
    ...Object.values(AI_AUDIO_PROVIDERS.USE_CASES),
    ...Object.values(AI_AUDIO_PROVIDERS.JOBS),
    ...((process.env.AI_AUDIO_PROCESSING_TRANSPORT ?? "http") === "rabbitmq"
      ? [
          AiAudioSeparationRequestedConsumer,
          AiAudioSeparationCompletedConsumer,
          AiAudioSeparationFailedConsumer,
        ]
      : []),
  ],
  exports: [
    AI_AUDIO_PROVIDERS.REPOSITORIES.AI_AUDIO_UPLOAD_REPOSITORY.provide,
    AI_AUDIO_PROVIDERS.REPOSITORIES.AI_AUDIO_SEPARATION_JOB_REPOSITORY.provide,
  ],
})
export class AiAudioModule {}
