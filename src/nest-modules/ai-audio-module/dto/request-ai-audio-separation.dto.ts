import { OmitType } from "@nestjs/swagger";

import { RequestAiAudioSeparationInputValidator } from "../../../core/ai-audio/application/use-cases/request-ai-audio-separation/request-ai-audio-separation.input";

export class RequestAiAudioSeparationDto extends OmitType(
  RequestAiAudioSeparationInputValidator,
  ["ai_audio_upload_id"] as const,
) {}
