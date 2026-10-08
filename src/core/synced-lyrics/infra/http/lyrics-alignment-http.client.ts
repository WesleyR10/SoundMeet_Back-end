import axios, { AxiosInstance } from "axios";

import {
  ILyricsAlignmentClient,
  LyricsAlignmentClientRequest,
  LyricsAlignmentClientResponse,
} from "../../application/ports/lyrics-alignment-client.interface";

// Mesmo formato de AiCifraAnalysisHttpClient (ai-cifra-module) — mesmo
// worker, endpoint diferente (/v1/align-lyrics em vez de /v2/analyze).
export class LyricsAlignmentHttpClient implements ILyricsAlignmentClient {
  constructor(
    private readonly http: AxiosInstance,
    private readonly path: string,
  ) {}

  async align(
    input: LyricsAlignmentClientRequest,
  ): Promise<LyricsAlignmentClientResponse> {
    const response = await this.http.post(this.path, input);
    return response.data as LyricsAlignmentClientResponse;
  }

  static create(config: { baseURL: string; timeoutMs: number; path: string }) {
    const http = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeoutMs,
      headers: { "Content-Type": "application/json" },
      maxBodyLength: Infinity,
    });
    return new LyricsAlignmentHttpClient(http, config.path);
  }
}
