import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  AiCifraAudioCandidate,
  IAiCifraAudioCandidatesResolver,
} from "../../ports/ai-cifra-audio-candidates-resolver.interface";
import { ResolveAiCifraAudioCandidatesUseCaseInput } from "./resolve-ai-cifra-audio-candidates.input";

export type ResolveAiCifraAudioCandidatesUseCaseOutput = {
  candidates: AiCifraAudioCandidate[];
};

export class ResolveAiCifraAudioCandidatesUseCase implements IUseCase<
  ResolveAiCifraAudioCandidatesUseCaseInput,
  ResolveAiCifraAudioCandidatesUseCaseOutput
> {
  constructor(private readonly resolver: IAiCifraAudioCandidatesResolver) {}

  async execute(
    input: ResolveAiCifraAudioCandidatesUseCaseInput,
  ): Promise<ResolveAiCifraAudioCandidatesUseCaseOutput> {
    const youtube_video_id =
      typeof input.youtube_video_id === "string" ? input.youtube_video_id : "";

    if (youtube_video_id.trim().length === 0) {
      throw new EntityValidationError([
        { youtube_video_id: ["youtube_video_id is required"] },
      ]);
    }

    const candidates = await this.resolver.resolveForYoutubeVideo({
      youtube_video_id: youtube_video_id.trim(),
    });

    return { candidates: Array.isArray(candidates) ? candidates : [] };
  }
}
