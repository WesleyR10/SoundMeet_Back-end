import axios, { AxiosInstance } from "axios";

import {
  AiCifraAudioCandidate,
  ResolveAiCifraAudioCandidatesInput,
} from "../../application/ports/ai-cifra-audio-candidates-resolver.interface";

type PipedStreamsResponse = {
  audioStreams?: Array<{
    url?: string;
    mimeType?: string;
    bitrate?: number;
  }>;
};

export class MusifyPipedAudioCandidatesResolver {
  constructor(private readonly https: AxiosInstance[]) {}

  async resolveForYoutubeVideo(
    input: ResolveAiCifraAudioCandidatesInput,
  ): Promise<AiCifraAudioCandidate[]> {
    for (const http of this.https) {
      let response: { data: PipedStreamsResponse };
      try {
        response = await http.get<PipedStreamsResponse>(
          `/streams/${encodeURIComponent(input.youtube_video_id)}`,
        );
      } catch {
        continue;
      }

      const audioStreams = Array.isArray(response.data?.audioStreams)
        ? response.data.audioStreams
        : [];

      const sorted = audioStreams
        .filter((s) => typeof s.url === "string" && s.url.trim().length > 0)
        .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
        .slice(0, 5);

      if (!sorted.length) {
        continue;
      }

      return sorted.map((s, idx) => {
        const mimeType = typeof s.mimeType === "string" ? s.mimeType : "";
        const contentType = mimeType.trim().length
          ? mimeType.split(";")[0]?.trim() || null
          : null;
        return {
          provider: "musify",
          audio_url: String(s.url),
          source: "youtube",
          source_id: input.youtube_video_id,
          content_type: contentType,
          original_filename: `${input.youtube_video_id}.${idx}.audio`,
        };
      });
    }

    return [];
  }

  static create(config: { baseURL: string; timeoutMs: number }) {
    const rawBaseURLs = `${config.baseURL}`
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const fallbackBaseURLs = [
      "https://pipedapi.tokhmi.xyz",
      "https://pipedapi.moomoo.me",
      "https://pipedapi.syncpundit.io",
      "https://api.looleh.xyz",
      "https://piped-api.lunar.icu",
    ];

    const baseURLs = Array.from(new Set([...rawBaseURLs, ...fallbackBaseURLs]));

    const https = baseURLs.map((baseURL) =>
      axios.create({
        baseURL,
        timeout: config.timeoutMs,
        maxRedirects: 3,
        headers: {
          Accept: "application/json",
        },
      }),
    );

    return new MusifyPipedAudioCandidatesResolver(https);
  }
}
