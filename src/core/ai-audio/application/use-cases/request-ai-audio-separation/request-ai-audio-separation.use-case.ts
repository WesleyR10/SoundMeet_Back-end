import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  AiAudioSeparationJob,
  AiAudioSeparationJobId,
} from "../../../domain/ai-audio-separation-job.aggregate";
import { IAiAudioSeparationJobRepository } from "../../../domain/ai-audio-separation-job.repository";
import {
  AiAudioUpload,
  AiAudioUploadId,
} from "../../../domain/ai-audio-upload.aggregate";
import { IAiAudioUploadRepository } from "../../../domain/ai-audio-upload.repository";
import { IAiAudioSeparationDispatcher } from "../../ports/ai-audio-separation-dispatcher.interface";
import { IAiAudioStorage } from "../../ports/ai-audio-storage.interface";
import {
  AiAudioSeparationJobOutput,
  AiAudioSeparationJobOutputMapper,
} from "../common/ai-audio-separation-job-output";
import { RequestAiAudioSeparationInput } from "./request-ai-audio-separation.input";

export class RequestAiAudioSeparationUseCase implements IUseCase<
  RequestAiAudioSeparationInput,
  AiAudioSeparationJobOutput
> {
  constructor(
    private readonly uploadRepo: IAiAudioUploadRepository,
    private readonly jobRepo: IAiAudioSeparationJobRepository,
    private readonly dispatcher: IAiAudioSeparationDispatcher,
    private readonly storage: IAiAudioStorage,
    private readonly defaultModelId: string,
    private readonly allowedModelIds: string[],
  ) {}

  async execute(
    input: RequestAiAudioSeparationInput,
  ): Promise<AiAudioSeparationJobOutput> {
    const upload = await this.uploadRepo.findById(
      new AiAudioUploadId(input.ai_audio_upload_id),
    );
    if (!upload) {
      throw new NotFoundError(input.ai_audio_upload_id, AiAudioUpload);
    }

    if (input.requesting_musician_id && !input.is_admin) {
      if (upload.musician_id.id !== input.requesting_musician_id) {
        throw new ForbiddenException(
          "Você não tem permissão para solicitar separação neste upload.",
        );
      }
    }

    if (upload.status === "rejected") {
      throw new EntityValidationError([
        {
          status: [
            `Upload is rejected: ${upload.rejected_reason ?? "unknown reason"}`,
          ],
        },
      ]);
    }

    const model_id = input.model_id ?? this.defaultModelId;
    const allowed = new Set(
      this.allowedModelIds.map((m) => m.trim()).filter((m) => m.length > 0),
    );

    if (!allowed.has(model_id)) {
      throw new EntityValidationError([
        {
          model_id: [`Model not allowed (${model_id})`],
        },
      ]);
    }

    const jobId = new AiAudioSeparationJobId();
    const output_prefix = `ai-audio/${upload.musician_id.id}/${upload.ai_audio_upload_id.id}/separations/${jobId.id}/${model_id}`;

    const job = AiAudioSeparationJob.create({
      ai_audio_separation_job_id: jobId,
      ai_audio_upload_id: upload.ai_audio_upload_id.id,
      musician_id: upload.musician_id.id,
      model_id,
      output_prefix,
      output_format: input.output_format ?? null,
    });

    if (job.notification.hasErrors()) {
      throw new EntityValidationError(job.notification.toJSON());
    }

    upload.markSeparationQueued();
    if (upload.notification.hasErrors()) {
      throw new EntityValidationError(upload.notification.toJSON());
    }

    await this.uploadRepo.update(upload);
    await this.jobRepo.insert(job);

    await this.dispatcher.enqueue({
      job_id: job.ai_audio_separation_job_id.id,
      model_id: job.model_id,
      input_object_key: upload.object_key,
      output_prefix: job.output_prefix,
      output_format: job.output_format,
    });

    return AiAudioSeparationJobOutputMapper.toOutput(job, (k) =>
      this.storage.getPublicUrl(k),
    );
  }
}
