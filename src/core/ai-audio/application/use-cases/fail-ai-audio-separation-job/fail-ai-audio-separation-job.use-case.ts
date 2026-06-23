import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  AiAudioSeparationJob,
  AiAudioSeparationJobId,
} from "../../../domain/ai-audio-separation-job.aggregate";
import { IAiAudioSeparationJobRepository } from "../../../domain/ai-audio-separation-job.repository";
import { AiAudioUploadId } from "../../../domain/ai-audio-upload.aggregate";
import { IAiAudioUploadRepository } from "../../../domain/ai-audio-upload.repository";
import { FailAiAudioSeparationJobInput } from "./fail-ai-audio-separation-job.input";

export class FailAiAudioSeparationJobUseCase implements IUseCase<
  FailAiAudioSeparationJobInput,
  void
> {
  constructor(
    private readonly uploadRepo: IAiAudioUploadRepository,
    private readonly jobRepo: IAiAudioSeparationJobRepository,
  ) {}

  async execute(input: FailAiAudioSeparationJobInput): Promise<void> {
    const job = await this.jobRepo.findById(
      new AiAudioSeparationJobId(input.job_id),
    );
    if (!job) {
      throw new NotFoundError(input.job_id, AiAudioSeparationJob);
    }

    if (job.status === "completed" || job.status === "failed") {
      return;
    }

    const upload = await this.uploadRepo.findById(
      new AiAudioUploadId(job.ai_audio_upload_id.id),
    );

    job.fail(input.error_code, input.error_message);
    if (job.notification.hasErrors()) {
      throw new EntityValidationError(job.notification.toJSON());
    }

    if (upload) {
      upload.markSeparationFailed(input.error_message);
      if (upload.notification.hasErrors()) {
        throw new EntityValidationError(upload.notification.toJSON());
      }
      await this.uploadRepo.update(upload);
    }

    await this.jobRepo.update(job);
  }
}
