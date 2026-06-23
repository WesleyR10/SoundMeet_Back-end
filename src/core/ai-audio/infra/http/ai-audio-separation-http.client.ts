import axios, { AxiosInstance } from "axios";

import {
  AiAudioSeparationClientRequest,
  AiAudioSeparationClientResponse,
  IAiAudioSeparationClient,
} from "../../application/ports/ai-audio-separation-client.interface";

export class AiAudioSeparationHttpClient implements IAiAudioSeparationClient {
  constructor(
    private readonly http: AxiosInstance,
    private readonly path: string,
  ) {}

  async separate(
    input: AiAudioSeparationClientRequest,
  ): Promise<AiAudioSeparationClientResponse> {
    const response = await this.http.post(this.path, input);
    return response.data as AiAudioSeparationClientResponse;
  }

  static create(config: { baseURL: string; timeoutMs: number; path: string }) {
    const http = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeoutMs,
      headers: { "Content-Type": "application/json" },
      maxBodyLength: Infinity,
    });
    return new AiAudioSeparationHttpClient(http, config.path);
  }
}
