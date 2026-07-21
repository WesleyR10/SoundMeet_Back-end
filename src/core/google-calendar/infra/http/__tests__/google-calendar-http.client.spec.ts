import { AxiosError, AxiosInstance } from "axios";

import {
  GoogleCalendarAuthError,
  GoogleCalendarUnavailableError,
} from "../../../application/ports/google-calendar-gateway.interface";
import { GoogleCalendarHttpClient } from "../google-calendar-http.client";

const axiosError = (status?: number, data?: unknown, code?: string) => {
  const error = new AxiosError("request failed", code);
  if (status !== undefined) {
    error.response = { status, data } as any;
  }
  return error;
};

const makeIdToken = (payload: Record<string, unknown>) =>
  `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

describe("GoogleCalendarHttpClient", () => {
  let tokenHttp: jest.Mocked<Pick<AxiosInstance, "post">>;
  let apiHttp: jest.Mocked<Pick<AxiosInstance, "post" | "patch" | "delete">>;
  let client: GoogleCalendarHttpClient;

  beforeEach(() => {
    tokenHttp = { post: jest.fn() };
    apiHttp = { post: jest.fn(), patch: jest.fn(), delete: jest.fn() };
    client = new GoogleCalendarHttpClient(
      tokenHttp as unknown as AxiosInstance,
      apiHttp as unknown as AxiosInstance,
      { clientId: "client-id", clientSecret: "client-secret" },
    );
  });

  describe("exchangeCodeForTokens", () => {
    it("troca o code e extrai o e-mail do id_token", async () => {
      tokenHttp.post.mockResolvedValue({
        data: {
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3599,
          scope: "https://www.googleapis.com/auth/calendar.events",
          id_token: makeIdToken({ email: "musico@gmail.com" }),
        },
      });

      const tokens = await client.exchangeCodeForTokens(
        "code-123",
        "http://localhost/callback",
      );

      expect(tokens).toEqual({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3599,
        scope: "https://www.googleapis.com/auth/calendar.events",
        email: "musico@gmail.com",
      });
      const body = tokenHttp.post.mock.calls[0][1] as string;
      expect(body).toContain("grant_type=authorization_code");
      expect(body).toContain("code=code-123");
    });

    it("mapeia invalid_grant para GoogleCalendarAuthError", async () => {
      tokenHttp.post.mockRejectedValue(
        axiosError(400, { error: "invalid_grant" }),
      );

      await expect(
        client.exchangeCodeForTokens("expired", "http://localhost/cb"),
      ).rejects.toThrow(GoogleCalendarAuthError);
    });
  });

  describe("refreshAccessToken", () => {
    it("renova o access token via refresh token", async () => {
      tokenHttp.post.mockResolvedValue({
        data: { access_token: "new-at", expires_in: 3599, scope: "s" },
      });

      const tokens = await client.refreshAccessToken("rt");

      expect(tokens.access_token).toBe("new-at");
      const body = tokenHttp.post.mock.calls[0][1] as string;
      expect(body).toContain("grant_type=refresh_token");
    });

    it("refresh token revogado vira GoogleCalendarAuthError", async () => {
      tokenHttp.post.mockRejectedValue(
        axiosError(400, { error: "invalid_grant" }),
      );

      await expect(client.refreshAccessToken("revoked")).rejects.toThrow(
        GoogleCalendarAuthError,
      );
    });
  });

  describe("createEvent", () => {
    const eventInput = {
      access_token: "at",
      calendar_id: "primary",
      event_id: "abc123",
      summary: "Show — Bar do Zé",
      start_at: new Date("2026-08-01T20:00:00Z"),
      end_at: new Date("2026-08-01T23:00:00Z"),
    };

    it("cria evento com id determinístico e Bearer token", async () => {
      apiHttp.post.mockResolvedValue({ data: { id: "abc123" } });

      const result = await client.createEvent(eventInput);

      expect(result).toEqual({ google_event_id: "abc123" });
      const [url, body, config] = apiHttp.post.mock.calls[0];
      expect(url).toBe("/calendars/primary/events");
      expect(body).toMatchObject({
        id: "abc123",
        summary: "Show — Bar do Zé",
        start: { dateTime: "2026-08-01T20:00:00.000Z" },
        end: { dateTime: "2026-08-01T23:00:00.000Z" },
      });
      expect((config as any).headers.Authorization).toBe("Bearer at");
    });

    it("409 com id determinístico = já criado em retry anterior → sucesso", async () => {
      apiHttp.post.mockRejectedValue(axiosError(409));

      const result = await client.createEvent(eventInput);

      expect(result).toEqual({ google_event_id: "abc123" });
    });

    it("401 vira GoogleCalendarAuthError (não-retriável)", async () => {
      apiHttp.post.mockRejectedValue(axiosError(401));

      await expect(client.createEvent(eventInput)).rejects.toThrow(
        GoogleCalendarAuthError,
      );
    });

    it("5xx transitório é retentado e depois vira Unavailable", async () => {
      apiHttp.post.mockRejectedValue(axiosError(503));

      await expect(client.createEvent(eventInput)).rejects.toThrow(
        GoogleCalendarUnavailableError,
      );
      // withRetry: 3 tentativas para erro transitório.
      expect(apiHttp.post).toHaveBeenCalledTimes(3);
    }, 15_000);

    it("5xx seguido de sucesso retorna normalmente (retry funciona)", async () => {
      apiHttp.post
        .mockRejectedValueOnce(axiosError(500))
        .mockResolvedValueOnce({ data: { id: "abc123" } });

      const result = await client.createEvent(eventInput);

      expect(result).toEqual({ google_event_id: "abc123" });
      expect(apiHttp.post).toHaveBeenCalledTimes(2);
    });
  });

  describe("deleteEvent", () => {
    const deleteInput = {
      access_token: "at",
      calendar_id: "primary",
      google_event_id: "abc123",
    };

    it("404 (já removido manualmente) conta como sucesso", async () => {
      apiHttp.delete.mockRejectedValue(axiosError(404));

      await expect(client.deleteEvent(deleteInput)).resolves.toBeUndefined();
    });

    it("410 (gone) conta como sucesso", async () => {
      apiHttp.delete.mockRejectedValue(axiosError(410));

      await expect(client.deleteEvent(deleteInput)).resolves.toBeUndefined();
    });

    it("401 vira GoogleCalendarAuthError", async () => {
      apiHttp.delete.mockRejectedValue(axiosError(401));

      await expect(client.deleteEvent(deleteInput)).rejects.toThrow(
        GoogleCalendarAuthError,
      );
    });
  });

  describe("revokeToken", () => {
    it("400 (token já inválido no Google) conta como sucesso", async () => {
      tokenHttp.post.mockRejectedValue(axiosError(400));

      await expect(client.revokeToken("rt")).resolves.toBeUndefined();
    });

    it("erro de rede vira GoogleCalendarUnavailableError", async () => {
      tokenHttp.post.mockRejectedValue(
        axiosError(undefined, undefined, "ECONNREFUSED"),
      );

      await expect(client.revokeToken("rt")).rejects.toThrow(
        GoogleCalendarUnavailableError,
      );
    });
  });
});
