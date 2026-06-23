import { execFile } from "child_process";
import { promisify } from "util";

import {
  AiCifraAudioCandidate,
  ResolveAiCifraAudioCandidatesInput,
} from "../../application/ports/ai-cifra-audio-candidates-resolver.interface";

const execFileAsync = promisify(execFile);

function parseCommand(command: string): { bin: string; args: string[] } {
  const raw = `${command ?? ""}`.trim();
  if (!raw) {
    return { bin: "", args: [] };
  }

  const parts: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const m of raw.matchAll(re)) {
    const v = m[1] ?? m[2] ?? m[3];
    if (typeof v === "string" && v.length) parts.push(v);
  }

  const [bin, ...args] = parts;
  return { bin: bin ?? "", args };
}

export class SimpMusicYtDlpAudioCandidatesResolver {
  constructor(
    private readonly config: {
      ytDlpBin: string;
      timeoutMs: number;
    },
  ) {}

  async resolveForYoutubeVideo(
    input: ResolveAiCifraAudioCandidatesInput,
  ): Promise<AiCifraAudioCandidate[]> {
    const parsed = parseCommand(this.config.ytDlpBin);
    if (!parsed.bin) return [];

    const videoId = encodeURIComponent(input.youtube_video_id);
    const urlsToTry = [
      `https://music.youtube.com/watch?v=${videoId}`,
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    const args = [
      "--no-warnings",
      "--no-playlist",
      "--geo-bypass",
      "-f",
      "bestaudio",
      "--get-url",
    ];

    for (const url of urlsToTry) {
      let stdout: string;
      try {
        ({ stdout } = await execFileAsync(
          parsed.bin,
          [...parsed.args, ...args, url],
          { timeout: this.config.timeoutMs },
        ));
      } catch {
        continue;
      }

      const firstUrl = stdout
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)[0];

      if (firstUrl) {
        return [
          {
            provider: "simpmusic",
            audio_url: firstUrl,
            source: "youtube",
            source_id: input.youtube_video_id,
            original_filename: `${input.youtube_video_id}.audio`,
          },
        ];
      }
    }

    return [];
  }
}
