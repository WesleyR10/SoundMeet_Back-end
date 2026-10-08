import axios from "axios";

import { AiCifraAnalysisHttpClient } from "../ai-cifra-analysis-http.client";

jest.mock("axios");

describe("AiCifraAnalysisHttpClient — header de autenticação do worker (A-10)", () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue({ post: jest.fn() } as never);
  });

  function headersFromCreate(): Record<string, string> {
    const config = mockedAxios.create.mock.calls[0][0] as {
      headers: Record<string, string>;
    };
    return config.headers;
  }

  it("envia x-ai-worker-token quando o token está configurado", () => {
    AiCifraAnalysisHttpClient.create({
      baseURL: "http://worker:8000",
      timeoutMs: 1000,
      path: "/v2/analyze",
      workerToken: "s3cr3t",
    });

    expect(headersFromCreate()["x-ai-worker-token"]).toBe("s3cr3t");
  });

  it("NÃO envia o header quando o token está ausente (dev sem auth)", () => {
    AiCifraAnalysisHttpClient.create({
      baseURL: "http://worker:8000",
      timeoutMs: 1000,
      path: "/v2/analyze",
    });

    expect(headersFromCreate()).not.toHaveProperty("x-ai-worker-token");
  });
});
