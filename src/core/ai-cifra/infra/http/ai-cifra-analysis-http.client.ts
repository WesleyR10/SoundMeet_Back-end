import axios, { AxiosInstance } from "axios";

import {
  AiCifraAnalysisClientRequest,
  AiCifraAnalysisClientResponse,
  IAiCifraAnalysisClient,
} from "../../application/ports/ai-cifra-analysis-client.interface";

export class AiCifraAnalysisHttpClient implements IAiCifraAnalysisClient {
  constructor(
    private readonly http: AxiosInstance,
    private readonly path: string,
  ) {}

  async analyze(
    input: AiCifraAnalysisClientRequest,
  ): Promise<AiCifraAnalysisClientResponse> {
    const response = await this.http.post(this.path, input);
    return response.data as AiCifraAnalysisClientResponse;
  }

  static create(config: {
    baseURL: string;
    timeoutMs: number;
    path: string;
    /** Shared secret enviado ao worker (A-10). Sem ele, o worker recusa. */
    workerToken?: string;
  }) {
    const http = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeoutMs,
      headers: {
        "Content-Type": "application/json",
        ...(config.workerToken
          ? { "x-ai-worker-token": config.workerToken }
          : {}),
      },
      maxBodyLength: Infinity,
    });
    return new AiCifraAnalysisHttpClient(http, config.path);
  }
}
