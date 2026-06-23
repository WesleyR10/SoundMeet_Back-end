import {
  AiCifraAudioCandidate,
  IAiCifraAudioCandidatesResolver,
  ResolveAiCifraAudioCandidatesInput,
} from "../../application/ports/ai-cifra-audio-candidates-resolver.interface";
import { MusifyPipedAudioCandidatesResolver } from "./musify-piped.audio-candidates-resolver";
import { SimpMusicYtDlpAudioCandidatesResolver } from "./simpmusic-yt-dlp.audio-candidates-resolver";

export class AiCifraAudioCandidatesResolver implements IAiCifraAudioCandidatesResolver {
  constructor(
    private readonly simpmusic: SimpMusicYtDlpAudioCandidatesResolver,
    private readonly musify: MusifyPipedAudioCandidatesResolver | null,
  ) {}

  async resolveForYoutubeVideo(
    input: ResolveAiCifraAudioCandidatesInput,
  ): Promise<AiCifraAudioCandidate[]> {
    const candidates: AiCifraAudioCandidate[] = [];

    try {
      candidates.push(...(await this.simpmusic.resolveForYoutubeVideo(input)));
    } catch {}

    if (this.musify) {
      try {
        candidates.push(...(await this.musify.resolveForYoutubeVideo(input)));
      } catch {}
    }

    return candidates;
  }
}
