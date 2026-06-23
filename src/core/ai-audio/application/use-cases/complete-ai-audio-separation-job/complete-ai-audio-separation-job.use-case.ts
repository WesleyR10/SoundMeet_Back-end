import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  AiAudioSeparationJob,
  AiAudioSeparationJobId,
} from "../../../domain/ai-audio-separation-job.aggregate";
import { IAiAudioSeparationJobRepository } from "../../../domain/ai-audio-separation-job.repository";
import { AiAudioSeparationOutput } from "../../../domain/ai-audio-separation-output.child-entity";
import { AiAudioUploadId } from "../../../domain/ai-audio-upload.aggregate";
import { IAiAudioUploadRepository } from "../../../domain/ai-audio-upload.repository";
import { CompleteAiAudioSeparationJobInput } from "./complete-ai-audio-separation-job.input";

export class CompleteAiAudioSeparationJobUseCase implements IUseCase<
  CompleteAiAudioSeparationJobInput,
  void
> {
  constructor(
    private readonly uploadRepo: IAiAudioUploadRepository,
    private readonly jobRepo: IAiAudioSeparationJobRepository,
  ) {}

  async execute(input: CompleteAiAudioSeparationJobInput): Promise<void> {
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

    if (!upload) {
      job.fail("UPLOAD_NOT_FOUND", "Upload não encontrado para este job");
      await this.jobRepo.update(job);
      return;
    }

    const outputs = input.outputs.map(
      (o) =>
        new AiAudioSeparationOutput({
          stem_name: o.stem_name,
          object_key: o.object_key,
          content_type: o.content_type,
          file_size: o.file_size ?? null,
        }),
    );

    job.complete(outputs);
    if (job.notification.hasErrors()) {
      throw new EntityValidationError(job.notification.toJSON());
    }

    upload.markSeparated();
    if (upload.notification.hasErrors()) {
      throw new EntityValidationError(upload.notification.toJSON());
    }

    await this.jobRepo.update(job);
    await this.uploadRepo.update(upload);
  }
}
