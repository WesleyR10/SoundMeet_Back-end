export type GoogleOAuthTokens = {
  access_token: string;
  /** Ausente em refresh (o Google mantém o refresh token original). */
  refresh_token?: string;
  expires_in: number;
  scope: string;
  /** E-mail extraído do id_token (escopo openid email) — só no exchange. */
  email?: string;
};

export type GoogleCalendarEventInput = {
  access_token: string;
  calendar_id: string;
  /**
   * ID determinístico do evento (base32hex — UUID do booking sem hífens é
   * válido). Torna o create idempotente entre retries: um 409 do Google
   * significa "já criado" e conta como sucesso.
   */
  event_id?: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  start_at: Date;
  end_at: Date;
};

export type CreateGoogleCalendarEventResult = {
  google_event_id: string;
};

export interface IGoogleCalendarGateway {
  exchangeCodeForTokens(
    code: string,
    redirect_uri: string,
  ): Promise<GoogleOAuthTokens>;
  refreshAccessToken(refresh_token: string): Promise<GoogleOAuthTokens>;
  revokeToken(token: string): Promise<void>;

  createEvent(
    input: GoogleCalendarEventInput,
  ): Promise<CreateGoogleCalendarEventResult>;
  updateEvent(
    input: GoogleCalendarEventInput & { google_event_id: string },
  ): Promise<void>;
  /** Idempotente — evento já removido no Google (404/410) conta como sucesso. */
  deleteEvent(input: {
    access_token: string;
    calendar_id: string;
    google_event_id: string;
  }): Promise<void>;
}

/**
 * Token revogado/inválido (401, invalid_grant) — NÃO retriável: o músico
 * precisa reconectar a conta. Listado em NON_RETRIABLE_ERRORS do
 * RabbitmqConsumeErrorFilter para não queimar retries à toa.
 */
export class GoogleCalendarAuthError extends Error {
  constructor(
    message = "Autorização do Google Calendar inválida ou revogada",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GoogleCalendarAuthError";
  }
}

/** Falha transitória (rede/5xx/timeout) — retriável via fila. */
export class GoogleCalendarUnavailableError extends Error {
  constructor(
    message = "Google Calendar indisponível",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GoogleCalendarUnavailableError";
  }
}
