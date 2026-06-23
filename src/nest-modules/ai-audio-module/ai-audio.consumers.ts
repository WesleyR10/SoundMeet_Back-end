import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, UseFilters, ValidationPipe } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import { CompleteAiAudioSeparationJobInputValidator } from "../../core/ai-audio/application/use-cases/complete-ai-audio-separation-job/complete-ai-audio-separation-job.input";
import { CompleteAiAudioSeparationJobUseCase } from "../../core/ai-audio/application/use-cases/complete-ai-audio-separation-job/complete-ai-audio-separation-job.use-case";
import { FailAiAudioSeparationJobInputValidator } from "../../core/ai-audio/application/use-cases/fail-ai-audio-separation-job/fail-ai-audio-separation-job.input";
import { FailAiAudioSeparationJobUseCase } from "../../core/ai-audio/application/use-cases/fail-ai-audio-separation-job/fail-ai-audio-separation-job.use-case";
import { ProcessAiAudioSeparationJobInputValidator } from "../../core/ai-audio/application/use-cases/process-ai-audio-separation-job/process-ai-audio-separation-job.input";
import { ProcessAiAudioSeparationJobUseCase } from "../../core/ai-audio/application/use-cases/process-ai-audio-separation-job/process-ai-audio-separation-job.use-case";
import { RabbitmqConsumeErrorFilter } from "../rabbitmq-module/rabbitmq-consume-error/rabbitmq-consume-error.filter";
import { AI_AUDIO_RABBITMQ } from "./rabbitmq/ai-audio.rabbitmq";

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class AiAudioSeparationRequestedConsumer {
  constructor(private moduleRef: ModuleRef) {}

  @RabbitSubscribe({
    exchange: AI_AUDIO_RABBITMQ.exchange,
    routingKey: AI_AUDIO_RABBITMQ.routingKeys.separationRequested,
    queue: AI_AUDIO_RABBITMQ.queues.separationRequested,
    allowNonJsonMessages: false,
    queueOptions: {
      durable: true,
      deadLetterExchange: AI_AUDIO_RABBITMQ.dlxExchange,
      deadLetterRoutingKey: AI_AUDIO_RABBITMQ.routingKeys.separationRequested,
      channel: AI_AUDIO_RABBITMQ.channel,
    },
  })
  async onSeparationRequested(msg: { job_id?: string }) {
    const input = new ProcessAiAudioSeparationJobInputValidator({
      job_id: `${msg?.job_id ?? ""}`,
    });

    await new ValidationPipe({
      errorHttpStatusCode: 422,
    }).transform(input, {
      metatype: ProcessAiAudioSeparationJobInputValidator,
      type: "body",
    });

    const useCase = await this.moduleRef.resolve(
      ProcessAiAudioSeparationJobUseCase,
    );
    await useCase.execute({ job_id: input.job_id });
  }
}

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class AiAudioSeparationCompletedConsumer {
  constructor(private moduleRef: ModuleRef) {}

  @RabbitSubscribe({
    exchange: AI_AUDIO_RABBITMQ.exchange,
    routingKey: AI_AUDIO_RABBITMQ.routingKeys.separationCompleted,
    queue: AI_AUDIO_RABBITMQ.queues.separationCompleted,
    allowNonJsonMessages: false,
    queueOptions: {
      durable: true,
      deadLetterExchange: AI_AUDIO_RABBITMQ.dlxExchange,
      deadLetterRoutingKey: AI_AUDIO_RABBITMQ.routingKeys.separationCompleted,
      channel: AI_AUDIO_RABBITMQ.channel,
    },
  })
  async onSeparationCompleted(msg: { job_id?: string; outputs?: any[] }) {
    const input = new CompleteAiAudioSeparationJobInputValidator({
      job_id: `${msg?.job_id ?? ""}`,
      outputs: Array.isArray(msg?.outputs) ? (msg.outputs as any) : [],
    });

    await new ValidationPipe({
      errorHttpStatusCode: 422,
    }).transform(input, {
      metatype: CompleteAiAudioSeparationJobInputValidator,
      type: "body",
    });

    const useCase = await this.moduleRef.resolve(
      CompleteAiAudioSeparationJobUseCase,
    );

    await useCase.execute({
      job_id: input.job_id,
      outputs: input.outputs,
    });
  }
}

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class AiAudioSeparationFailedConsumer {
  constructor(private moduleRef: ModuleRef) {}

  @RabbitSubscribe({
    exchange: AI_AUDIO_RABBITMQ.exchange,
    routingKey: AI_AUDIO_RABBITMQ.routingKeys.separationFailed,
    queue: AI_AUDIO_RABBITMQ.queues.separationFailed,
    allowNonJsonMessages: false,
    queueOptions: {
      durable: true,
      deadLetterExchange: AI_AUDIO_RABBITMQ.dlxExchange,
      deadLetterRoutingKey: AI_AUDIO_RABBITMQ.routingKeys.separationFailed,
      channel: AI_AUDIO_RABBITMQ.channel,
    },
  })
  async onSeparationFailed(msg: {
    job_id?: string;
    error_code?: string;
    error_message?: string;
    details?: string | null;
  }) {
    const input = new FailAiAudioSeparationJobInputValidator({
      job_id: `${msg?.job_id ?? ""}`,
      error_code: `${msg?.error_code ?? ""}`,
      error_message: `${msg?.error_message ?? ""}`,
      details: typeof msg?.details === "string" ? msg.details : null,
    });

    await new ValidationPipe({
      errorHttpStatusCode: 422,
    }).transform(input, {
      metatype: FailAiAudioSeparationJobInputValidator,
      type: "body",
    });

    const useCase = await this.moduleRef.resolve(
      FailAiAudioSeparationJobUseCase,
    );
    await useCase.execute({
      job_id: input.job_id,
      error_code: input.error_code,
      error_message: input.error_message,
    });
  }
}
