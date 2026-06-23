import { OmitType } from "@nestjs/swagger";

import { UpdateAiAudioSeparationJobProgressInputValidator } from "../../../core/ai-audio/application/use-cases/update-ai-audio-separation-job-progress/update-ai-audio-separation-job-progress.input";

export class UpdateAiAudioSeparationJobProgressDto extends OmitType(
  UpdateAiAudioSeparationJobProgressInputValidator,
  ["id"] as const,
) {}
