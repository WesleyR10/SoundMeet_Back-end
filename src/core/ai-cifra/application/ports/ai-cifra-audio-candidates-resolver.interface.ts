export type AiCifraAudioCandidate = {
  provider: "simpmusic" | "musify";
  audio_url: string;
  source: string;
  source_id: string;
  content_type?: string | null;
  original_filename?: string | null;
};

export type ResolveAiCifraAudioCandidatesInput = {
  youtube_video_id: string;
};

export interface IAiCifraAudioCandidatesResolver {
  resolveForYoutubeVideo(
    input: ResolveAiCifraAudioCandidatesInput,
  ): Promise<AiCifraAudioCandidate[]>;
}
