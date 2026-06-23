import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  AiAudioSeparationJob,
  AiAudioSeparationJobId,
} from "../../../domain/ai-audio-separation-job.aggregate";
import { IAiAudioSeparationJobRepository } from "../../../domain/ai-audio-separation-job.repository";
import { AiAudioSeparationOutput } from "../../../domain/ai-audio-separation-output.child-entity";
import { UpdateAiAudioSeparationJobProgressInput } from "./update-ai-audio-separation-job-progress.input";

export class UpdateAiAudioSeparationJobProgressUseCase implements IUseCase<
  UpdateAiAudioSeparationJobProgressInput,
  void
> {
  constructor(private readonly jobRepo: IAiAudioSeparationJobRepository) {}

  async execute(input: UpdateAiAudioSeparationJobProgressInput): Promise<void> {
    const job = await this.jobRepo.findById(
      new AiAudioSeparationJobId(input.id),
    );
    if (!job) {
      throw new NotFoundError(input.id, AiAudioSeparationJob);
    }

    if (job.status === "completed" || job.status === "failed") {
      return;
    }

    const nextPercent = Math.min(
      100,
      Math.max(job.progress_percent, Math.floor(input.progress_percent)),
    );

    const outputs = Array.isArray(input.outputs)
      ? input.outputs.map(
          (o) =>
            new AiAudioSeparationOutput({
              stem_name: o.stem_name,
              object_key: o.object_key,
              content_type: o.content_type,
              file_size: o.file_size ?? null,
            }),
        )
      : undefined;

    job.updateProgress({
      progress_percent: nextPercent,
      progress_stage: input.progress_stage ?? undefined,
      ...(outputs ? { outputs } : {}),
    });

    await this.jobRepo.update(job);
  }
}
