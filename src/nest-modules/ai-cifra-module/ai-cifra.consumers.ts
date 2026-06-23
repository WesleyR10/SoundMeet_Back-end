import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, UseFilters, ValidationPipe } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import { CompleteAiCifraAnalysisJobInputValidator } from "../../core/ai-cifra/application/use-cases/complete-ai-cifra-analysis-job/complete-ai-cifra-analysis-job.input";
import { CompleteAiCifraAnalysisJobUseCase } from "../../core/ai-cifra/application/use-cases/complete-ai-cifra-analysis-job/complete-ai-cifra-analysis-job.use-case";
import { FailAiCifraAnalysisJobInputValidator } from "../../core/ai-cifra/application/use-cases/fail-ai-cifra-analysis-job/fail-ai-cifra-analysis-job.input";
import { FailAiCifraAnalysisJobUseCase } from "../../core/ai-cifra/application/use-cases/fail-ai-cifra-analysis-job/fail-ai-cifra-analysis-job.use-case";
import { ProcessAiCifraAnalysisJobInputValidator } from "../../core/ai-cifra/application/use-cases/process-ai-cifra-analysis-job/process-ai-cifra-analysis-job.input";
import { ProcessAiCifraAnalysisJobUseCase } from "../../core/ai-cifra/application/use-cases/process-ai-cifra-analysis-job/process-ai-cifra-analysis-job.use-case";
import { UpdateAiCifraAnalysisJobProgressInputValidator } from "../../core/ai-cifra/application/use-cases/update-ai-cifra-analysis-job-progress/update-ai-cifra-analysis-job-progress.input";
import { UpdateAiCifraAnalysisJobProgressUseCase } from "../../core/ai-cifra/application/use-cases/update-ai-cifra-analysis-job-progress/update-ai-cifra-analysis-job-progress.use-case";
import { RabbitmqConsumeErrorFilter } from "../rabbitmq-module/rabbitmq-consume-error/rabbitmq-consume-error.filter";
import { AI_CIFRA_RABBITMQ } from "./rabbitmq/ai-cifra.rabbitmq";

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class AiCifraAnalysisRequestedConsumer {
  constructor(private moduleRef: ModuleRef) {}

  @RabbitSubscribe({
    exchange: AI_CIFRA_RABBITMQ.exchange,
    routingKey: AI_CIFRA_RABBITMQ.routingKeys.analysisRequested,
    queue: AI_CIFRA_RABBITMQ.queues.analysisRequested,
    allowNonJsonMessages: false,
    queueOptions: {
      durable: true,
      deadLetterExchange: AI_CIFRA_RABBITMQ.dlxExchange,
      deadLetterRoutingKey: AI_CIFRA_RABBITMQ.routingKeys.analysisRequested,
      channel: AI_CIFRA_RABBITMQ.channel,
    },
  })
  async onAnalysisRequested(msg: { job_id?: string }) {
    const input = new ProcessAiCifraAnalysisJobInputValidator({
      job_id: `${msg?.job_id ?? ""}`,
    });

    await new ValidationPipe({
      errorHttpStatusCode: 422,
    }).transform(input, {
      metatype: ProcessAiCifraAnalysisJobInputValidator,
      type: "body",
    });

    const useCase = await this.moduleRef.resolve(
      ProcessAiCifraAnalysisJobUseCase,
    );
    await useCase.execute({ job_id: input.job_id });
  }
}

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class AiCifraAnalysisProgressConsumer {
  constructor(private moduleRef: ModuleRef) {}

  @RabbitSubscribe({
    exchange: AI_CIFRA_RABBITMQ.exchange,
    routingKey: AI_CIFRA_RABBITMQ.routingKeys.analysisProgress,
    queue: AI_CIFRA_RABBITMQ.queues.analysisProgress,
    allowNonJsonMessages: false,
    queueOptions: {
      durable: true,
      deadLetterExchange: AI_CIFRA_RABBITMQ.dlxExchange,
      deadLetterRoutingKey: AI_CIFRA_RABBITMQ.routingKeys.analysisProgress,
      channel: AI_CIFRA_RABBITMQ.channel,
    },
  })
  async onAnalysisProgress(msg: {
    job_id?: string;
    progress_percent?: number;
    progress_stage?: string | null;
  }) {
    const input = new UpdateAiCifraAnalysisJobProgressInputValidator({
      id: `${msg?.job_id ?? ""}`,
      progress_percent: Number(msg?.progress_percent ?? 0),
      progress_stage:
        typeof msg?.progress_stage === "string" ? msg.progress_stage : null,
    });

    await new ValidationPipe({
      errorHttpStatusCode: 422,
    }).transform(input, {
      metatype: UpdateAiCifraAnalysisJobProgressInputValidator,
      type: "body",
    });

    const useCase = await this.moduleRef.resolve(
      UpdateAiCifraAnalysisJobProgressUseCase,
    );
    await useCase.execute({
      id: input.id,
      progress_percent: input.progress_percent,
      progress_stage: input.progress_stage,
    });
  }
}

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class AiCifraAnalysisCompletedConsumer {
  constructor(private moduleRef: ModuleRef) {}

  @RabbitSubscribe({
    exchange: AI_CIFRA_RABBITMQ.exchange,
    routingKey: AI_CIFRA_RABBITMQ.routingKeys.analysisCompleted,
    queue: AI_CIFRA_RABBITMQ.queues.analysisCompleted,
    allowNonJsonMessages: false,
    queueOptions: {
      durable: true,
      deadLetterExchange: AI_CIFRA_RABBITMQ.dlxExchange,
      deadLetterRoutingKey: AI_CIFRA_RABBITMQ.routingKeys.analysisCompleted,
      channel: AI_CIFRA_RABBITMQ.channel,
    },
  })
  async onAnalysisCompleted(msg: {
    job_id?: string;
    bpm?: number | null;
    key?: string | null;
    time_signature?: string | null;
    chords?: any[] | null;
    segments?: any[] | null;
    artifacts?: any | null;
  }) {
    const input = new CompleteAiCifraAnalysisJobInputValidator({
      job_id: `${msg?.job_id ?? ""}`,
      bpm: typeof msg?.bpm === "number" ? msg.bpm : null,
      key: typeof msg?.key === "string" ? msg.key : null,
      time_signature:
        typeof msg?.time_signature === "string" ? msg.time_signature : null,
      chords: Array.isArray(msg?.chords) ? msg.chords : [],
      segments: Array.isArray(msg?.segments) ? msg.segments : [],
      artifacts: msg?.artifacts ?? null,
    });

    await new ValidationPipe({
      errorHttpStatusCode: 422,
    }).transform(input, {
      metatype: CompleteAiCifraAnalysisJobInputValidator,
      type: "body",
    });

    const useCase = await this.moduleRef.resolve(
      CompleteAiCifraAnalysisJobUseCase,
    );
    await useCase.execute({
      job_id: input.job_id,
      bpm: input.bpm,
      key: input.key,
      time_signature: input.time_signature,
      chords: (input as any).chords,
      segments: (input as any).segments,
      artifacts: (input as any).artifacts,
    });
  }
}

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class AiCifraAnalysisFailedConsumer {
  constructor(private moduleRef: ModuleRef) {}

  @RabbitSubscribe({
    exchange: AI_CIFRA_RABBITMQ.exchange,
    routingKey: AI_CIFRA_RABBITMQ.routingKeys.analysisFailed,
    queue: AI_CIFRA_RABBITMQ.queues.analysisFailed,
    allowNonJsonMessages: false,
    queueOptions: {
      durable: true,
      deadLetterExchange: AI_CIFRA_RABBITMQ.dlxExchange,
      deadLetterRoutingKey: AI_CIFRA_RABBITMQ.routingKeys.analysisFailed,
      channel: AI_CIFRA_RABBITMQ.channel,
    },
  })
  async onAnalysisFailed(msg: {
    job_id?: string;
    error_code?: string;
    error_message?: string;
    details?: string | null;
  }) {
    const input = new FailAiCifraAnalysisJobInputValidator({
      job_id: `${msg?.job_id ?? ""}`,
      error_code: `${msg?.error_code ?? ""}`,
      error_message: `${msg?.error_message ?? ""}`,
      details: typeof msg?.details === "string" ? msg.details : null,
    });

    await new ValidationPipe({
      errorHttpStatusCode: 422,
    }).transform(input, {
      metatype: FailAiCifraAnalysisJobInputValidator,
      type: "body",
    });

    const useCase = await this.moduleRef.resolve(FailAiCifraAnalysisJobUseCase);
    await useCase.execute({
      job_id: input.job_id,
      error_code: input.error_code,
      error_message: input.error_message,
    });
  }
}
