import axios, { AxiosInstance } from "axios";
import https from "https";

import {
  ILrcLibClient,
  LrcLibFindLyricsRequest,
  LrcLibLyrics,
  LrcLibSearchLyricsRequest,
} from "../../application/ports/lrclib-client.interface";

export class LrcLibHttpClient implements ILrcLibClient {
  constructor(private readonly http: AxiosInstance) {}

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private isTransientError(error: any): boolean {
    const status = error?.response?.status;
    if (typeof status === "number") {
      if (status === 429) return true;
      if (status >= 500) return true;
      return false;
    }

    const code = typeof error?.code === "string" ? error.code : "";
    if (!code) return false;
    return (
      code === "ECONNABORTED" ||
      code === "ETIMEDOUT" ||
      code === "ECONNRESET" ||
      code === "EAI_AGAIN" ||
      code === "ENOTFOUND" ||
      code === "ENETUNREACH"
    );
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const max = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        if (!this.isTransientError(error) || attempt === max) {
          throw error;
        }

        const base = 400;
        const backoff = Math.min(10_000, base * 2 ** (attempt - 1));
        const jitter = Math.floor(Math.random() * 250);
        const extra = error?.response?.status === 429 ? 5_000 : 0;
        await this.sleep(backoff + jitter + extra);
      }
    }

    throw lastError;
  }

  async findLyrics(
    input: LrcLibFindLyricsRequest,
  ): Promise<LrcLibLyrics | null> {
    try {
      const response = await this.withRetry(() =>
        this.http.get("/api/get", {
          params: {
            track_name: input.track_name,
            artist_name: input.artist_name,
            album_name: input.album_name,
            duration:
              typeof input.duration_seconds === "number"
                ? Math.max(0, Math.round(input.duration_seconds))
                : undefined,
            cached: input.cached === true ? true : undefined,
          },
        }),
      );
      return response.data as LrcLibLyrics;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404) return null;
      throw error;
    }
  }

  async searchLyrics(
    input: LrcLibSearchLyricsRequest,
  ): Promise<LrcLibLyrics[]> {
    const response = await this.withRetry(() =>
      this.http.get("/api/search", {
        params: {
          q: input.q,
          track_name: input.track_name,
          artist_name: input.artist_name,
          album_name: input.album_name,
        },
      }),
    );
    const data = response.data;
    return Array.isArray(data) ? (data as LrcLibLyrics[]) : [];
  }

  static create(config: { baseURL: string; timeoutMs: number }) {
    const httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      keepAliveMsecs: 15_000,
    });

    const http = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeoutMs,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "soundmeet-backend (lrclib;lrcget-compatible)",
      },
      httpsAgent,
      family: 4,
    });
    return new LrcLibHttpClient(http);
  }
}
