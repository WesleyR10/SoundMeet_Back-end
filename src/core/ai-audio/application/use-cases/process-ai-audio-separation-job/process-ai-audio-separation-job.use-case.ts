import { IUseCase } from "../../../../shared/application/use-case.interface";
import { DomainError } from "../../../../shared/domain/errors/domain.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  AiAudioSeparationJob,
  AiAudioSeparationJobId,
} from "../../../domain/ai-audio-separation-job.aggregate";
import { IAiAudioSeparationJobRepository } from "../../../domain/ai-audio-separation-job.repository";
import { AiAudioSeparationOutput } from "../../../domain/ai-audio-separation-output.child-entity";
import { AiAudioUploadId } from "../../../domain/ai-audio-upload.aggregate";
import { IAiAudioUploadRepository } from "../../../domain/ai-audio-upload.repository";
import { IAiAudioSeparationClient } from "../../ports/ai-audio-separation-client.interface";
import { ProcessAiAudioSeparationJobInput } from "./process-ai-audio-separation-job.input";

export class AiAudioSeparationRetryableError extends DomainError {
  constructor(
    public readonly code: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, {
      cause,
      metadata: {
        code,
      },
    });
  }
}

export class ProcessAiAudioSeparationJobUseCase implements IUseCase<
  ProcessAiAudioSeparationJobInput,
  void
> {
  constructor(
    private readonly uploadRepo: IAiAudioUploadRepository,
    private readonly jobRepo: IAiAudioSeparationJobRepository,
    private readonly client: IAiAudioSeparationClient,
  ) {}

  async execute(input: ProcessAiAudioSeparationJobInput): Promise<void> {
    const job = await this.jobRepo.findById(
      new AiAudioSeparationJobId(input.job_id),
    );
    if (!job) {
      throw new NotFoundError(input.job_id, AiAudioSeparationJob);
    }

    if (job.status !== "queued") {
      return;
    }

    const upload = await this.uploadRepo.findById(
      new AiAudioUploadId(job.ai_audio_upload_id.id),
    );
    if (!upload) {
      job.fail("UPLOAD_NOT_FOUND", "Upload não encontrado para este job");
      await this.jobRepo.update(job);
      return;
    }

    job.start();
    upload.markSeparating();

    await this.jobRepo.update(job);
    await this.uploadRepo.update(upload);

    try {
      const response = await this.client.separate({
        job_id: job.ai_audio_separation_job_id.id,
        model_id: job.model_id,
        input_object_key: upload.object_key,
        output_prefix: job.output_prefix,
        output_format: job.output_format ?? undefined,
      });

      const outputs = response.outputs.map(
        (o) =>
          new AiAudioSeparationOutput({
            stem_name: o.stem_name,
            object_key: o.object_key,
            content_type: o.content_type,
            file_size: o.file_size ?? null,
          }),
      );

      job.complete(outputs);
      upload.markSeparated();

      await this.jobRepo.update(job);
      await this.uploadRepo.update(upload);
    } catch (error: any) {
      const { code, message } = this.mapError(error);
      if (this.isTransientError(code)) {
        job.requeue(code, message);
        upload.markSeparationQueued();
        await this.jobRepo.update(job);
        await this.uploadRepo.update(upload);
        throw new AiAudioSeparationRetryableError(code, message, error);
      } else {
        job.fail(code, message);
        upload.markSeparationFailed(message);
        await this.jobRepo.update(job);
        await this.uploadRepo.update(upload);
      }
    }
  }

  private isTransientError(code: string): boolean {
    return code === "SEPARATION_TIMEOUT" || code === "SEPARATION_UNAVAILABLE";
  }

  private mapError(error: any): { code: string; message: string } {
    const response = error?.response;
    const responseData = response?.data;
    const httpStatus = response?.status;

    if (responseData?.code && responseData?.message) {
      return {
        code: `${responseData.code}`,
        message: `${responseData.message}`,
      };
    }

    if (responseData?.detail?.code && responseData?.detail?.message) {
      return {
        code: `${responseData.detail.code}`,
        message: `${responseData.detail.message}`,
      };
    }

    if (httpStatus === 404) {
      return {
        code: "SEPARATION_SERVICE_NOT_FOUND",
        message: "Serviço de separação não encontrado",
      };
    }

    if (typeof httpStatus === "number" && httpStatus >= 500) {
      return {
        code: "SEPARATION_UNAVAILABLE",
        message: "Serviço de separação indisponível",
      };
    }

    if (error?.code === "ECONNABORTED") {
      return {
        code: "SEPARATION_TIMEOUT",
        message: "Timeout no serviço de separação",
      };
    }

    if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") {
      return {
        code: "SEPARATION_UNAVAILABLE",
        message: "Serviço de separação indisponível",
      };
    }

    const msg = error?.message ?? "Falha desconhecida ao separar áudio";
    return { code: "SEPARATION_FAILED", message: `${msg}` };
  }
}
