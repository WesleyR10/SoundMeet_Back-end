import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { AiAudioSeparationJob } from "../../../domain/ai-audio-separation-job.aggregate";
import { AiAudioSeparationJobId } from "../../../domain/ai-audio-separation-job.aggregate";
import { IAiAudioSeparationJobRepository } from "../../../domain/ai-audio-separation-job.repository";
import { IAiAudioStorage } from "../../ports/ai-audio-storage.interface";
import {
  AiAudioSeparationJobOutput,
  AiAudioSeparationJobOutputMapper,
} from "../common/ai-audio-separation-job-output";
import { GetAiAudioSeparationJobInput } from "./get-ai-audio-separation-job.input";

export class GetAiAudioSeparationJobUseCase implements IUseCase<
  GetAiAudioSeparationJobInput,
  AiAudioSeparationJobOutput
> {
  constructor(
    private readonly jobRepo: IAiAudioSeparationJobRepository,
    private readonly storage: IAiAudioStorage,
  ) {}

  async execute(
    input: GetAiAudioSeparationJobInput,
  ): Promise<AiAudioSeparationJobOutput> {
    const job = await this.jobRepo.findById(
      new AiAudioSeparationJobId(input.id),
    );
    if (!job) {
      throw new NotFoundError(input.id, AiAudioSeparationJob);
    }

    if (input.requesting_musician_id && !input.is_admin) {
      if (job.musician_id.id !== input.requesting_musician_id) {
        throw new ForbiddenException(
          "Você não tem permissão para consultar este job de separação.",
        );
      }
    }

    return AiAudioSeparationJobOutputMapper.toOutput(job, (k) =>
      this.storage.getPublicUrl(k),
    );
  }
}
