import axios, { AxiosInstance, isAxiosError } from "axios";

import {
  CreateGoogleCalendarEventResult,
  GoogleCalendarAuthError,
  GoogleCalendarEventInput,
  GoogleCalendarUnavailableError,
  GoogleOAuthTokens,
  IGoogleCalendarGateway,
} from "../../application/ports/google-calendar-gateway.interface";

export type GoogleCalendarHttpClientConfig = {
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
};

/**
 * Adapter real da API do Google Calendar (axios cru, sem SDK `googleapis` —
 * mesmo padrão do LrcLibHttpClient/AsaasGatewayAdapter). Stateless: o access
 * token válido chega pronto em cada chamada; o ciclo de vida do token
 * (refresh/persistência) fica na camada de aplicação.
 */
export class GoogleCalendarHttpClient implements IGoogleCalendarGateway {
  constructor(
    private readonly tokenHttp: AxiosInstance,
    private readonly apiHttp: AxiosInstance,
    private readonly config: GoogleCalendarHttpClientConfig,
  ) {}

  static create(config: GoogleCalendarHttpClientConfig) {
    const timeout = config.timeoutMs ?? 10_000;
    const tokenHttp = axios.create({
      baseURL: "https://oauth2.googleapis.com",
      timeout,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const apiHttp = axios.create({
      baseURL: "https://www.googleapis.com/calendar/v3",
      timeout,
      headers: { "Content-Type": "application/json" },
    });
    return new GoogleCalendarHttpClient(tokenHttp, apiHttp, config);
  }

  async exchangeCodeForTokens(
    code: string,
    redirect_uri: string,
  ): Promise<GoogleOAuthTokens> {
    const data = await this.postToken({
      grant_type: "authorization_code",
      code,
      redirect_uri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      scope: data.scope,
      email: this.extractEmailFromIdToken(data.id_token),
    };
  }

  async refreshAccessToken(refresh_token: string): Promise<GoogleOAuthTokens> {
    const data = await this.postToken({
      grant_type: "refresh_token",
      refresh_token,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
      scope: data.scope,
    };
  }

  async revokeToken(token: string): Promise<void> {
    try {
      await this.withRetry(() =>
        this.tokenHttp.post(
          "/revoke",
          new URLSearchParams({ token }).toString(),
        ),
      );
    } catch (error) {
      // Token já inválido/revogado no Google — objetivo alcançado.
      if (isAxiosError(error) && error.response?.status === 400) {
        return;
      }
      throw this.toGatewayError(error);
    }
  }

  async createEvent(
    input: GoogleCalendarEventInput,
  ): Promise<CreateGoogleCalendarEventResult> {
    try {
      const response = await this.withRetry(() =>
        this.apiHttp.post(
          `/calendars/${encodeURIComponent(input.calendar_id)}/events`,
          {
            ...this.buildEventBody(input),
            ...(input.event_id ? { id: input.event_id } : {}),
          },
          { headers: this.authHeader(input.access_token) },
        ),
      );
      return { google_event_id: response.data.id };
    } catch (error) {
      // 409 com id determinístico = evento já criado num retry anterior.
      if (
        input.event_id &&
        isAxiosError(error) &&
        error.response?.status === 409
      ) {
        return { google_event_id: input.event_id };
      }
      throw this.toGatewayError(error);
    }
  }

  async updateEvent(
    input: GoogleCalendarEventInput & { google_event_id: string },
  ): Promise<void> {
    try {
      await this.withRetry(() =>
        this.apiHttp.patch(
          `/calendars/${encodeURIComponent(input.calendar_id)}/events/${encodeURIComponent(input.google_event_id)}`,
          this.buildEventBody(input),
          { headers: this.authHeader(input.access_token) },
        ),
      );
    } catch (error) {
      throw this.toGatewayError(error);
    }
  }

  async deleteEvent(input: {
    access_token: string;
    calendar_id: string;
    google_event_id: string;
  }): Promise<void> {
    try {
      await this.withRetry(() =>
        this.apiHttp.delete(
          `/calendars/${encodeURIComponent(input.calendar_id)}/events/${encodeURIComponent(input.google_event_id)}`,
          { headers: this.authHeader(input.access_token) },
        ),
      );
    } catch (error) {
      // Evento já removido manualmente pelo músico — delete é idempotente.
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404 || status === 410) {
          return;
        }
      }
      throw this.toGatewayError(error);
    }
  }

  private buildEventBody(input: GoogleCalendarEventInput) {
    return {
      summary: input.summary,
      description: input.description ?? undefined,
      location: input.location ?? undefined,
      start: { dateTime: input.start_at.toISOString() },
      end: { dateTime: input.end_at.toISOString() },
    };
  }

  private authHeader(accessToken: string): { Authorization: string } {
    return { Authorization: `Bearer ${accessToken}` };
  }

  private async postToken(params: Record<string, string>): Promise<any> {
    try {
      const response = await this.withRetry(() =>
        this.tokenHttp.post("/token", new URLSearchParams(params).toString()),
      );
      return response.data;
    } catch (error) {
      throw this.toGatewayError(error);
    }
  }

  /**
   * O e-mail vem do id_token (escopo openid email) recebido direto do token
   * endpoint do Google via TLS — decodificação sem verificação de assinatura
   * é aceitável nesse canal (não é um token apresentado por terceiros).
   */
  private extractEmailFromIdToken(idToken?: string): string | undefined {
    if (!idToken) {
      return undefined;
    }
    try {
      const payloadSegment = idToken.split(".")[1];
      const payload = JSON.parse(
        Buffer.from(payloadSegment, "base64url").toString("utf8"),
      );
      return typeof payload.email === "string" ? payload.email : undefined;
    } catch {
      return undefined;
    }
  }

  private toGatewayError(error: unknown): Error {
    if (
      error instanceof GoogleCalendarAuthError ||
      error instanceof GoogleCalendarUnavailableError
    ) {
      return error;
    }

    if (isAxiosError(error)) {
      const status = error.response?.status;
      const oauthError = (error.response?.data as any)?.error;
      if (status === 401 || oauthError === "invalid_grant") {
        return new GoogleCalendarAuthError(undefined, error);
      }
      if (status === 403 && oauthError !== "rate_limit_exceeded") {
        // 403 sem escopo/permissão — reconexão necessária, não retriável.
        return new GoogleCalendarAuthError(
          "Permissão insuficiente no Google Calendar",
          error,
        );
      }
      return new GoogleCalendarUnavailableError(
        `Google Calendar request failed: ${status ?? error.code ?? "network error"}`,
        error,
      );
    }

    return new GoogleCalendarUnavailableError(undefined, error);
  }

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
}
