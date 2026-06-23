import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { RabbitmqModule } from "../rabbitmq-module/rabbitmq.module";
import {
  AiAudioSeparationCompletedConsumer,
  AiAudioSeparationFailedConsumer,
  AiAudioSeparationRequestedConsumer,
} from "./ai-audio.consumers";
import { AiAudioController } from "./ai-audio.controller";
import { AI_AUDIO_PROVIDERS } from "./ai-audio.providers";
import { AiAudioUploadsController } from "./ai-audio-uploads.controller";

@Module({
  imports: [
    DatabaseModule,
    ...((process.env.AI_AUDIO_PROCESSING_TRANSPORT ?? "http") === "rabbitmq"
      ? [RabbitmqModule.forFeature()]
      : []),
  ],
  controllers: [AiAudioController, AiAudioUploadsController],
  providers: [
    ...Object.values(AI_AUDIO_PROVIDERS.REPOSITORIES),
    ...Object.values(AI_AUDIO_PROVIDERS.INFRA_PROVIDERS),
    ...Object.values(AI_AUDIO_PROVIDERS.USE_CASES),
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
