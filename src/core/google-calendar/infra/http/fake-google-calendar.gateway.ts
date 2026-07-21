import {
  CreateGoogleCalendarEventResult,
  GoogleCalendarAuthError,
  GoogleCalendarEventInput,
  GoogleCalendarUnavailableError,
  GoogleOAuthTokens,
  IGoogleCalendarGateway,
} from "../../application/ports/google-calendar-gateway.interface";

/**
 * Fake determinístico para testes — registra cada chamada para asserção e
 * permite simular falhas (mesmo papel do FakeGeocodingService).
 */
export class FakeGoogleCalendarGateway implements IGoogleCalendarGateway {
  readonly exchangedCodes: { code: string; redirect_uri: string }[] = [];
  readonly refreshedTokens: string[] = [];
  readonly revokedTokens: string[] = [];
  readonly createdEvents: GoogleCalendarEventInput[] = [];
  readonly updatedEvents: (GoogleCalendarEventInput & {
    google_event_id: string;
  })[] = [];
  readonly deletedEvents: {
    access_token: string;
    calendar_id: string;
    google_event_id: string;
  }[] = [];

  private failWith: Error | null = null;
  private nextEventId = 1;
  private tokensToReturn: GoogleOAuthTokens = {
    access_token: "fake-access-token",
    refresh_token: "fake-refresh-token",
    expires_in: 3600,
    scope: "https://www.googleapis.com/auth/calendar.events openid email",
    email: "musico@gmail.com",
  };

  simulateAuthError() {
    this.failWith = new GoogleCalendarAuthError();
    return this;
  }

  simulateUnavailable() {
    this.failWith = new GoogleCalendarUnavailableError();
    return this;
  }

  clearFailure() {
    this.failWith = null;
    return this;
  }

  setTokens(tokens: Partial<GoogleOAuthTokens>) {
    this.tokensToReturn = { ...this.tokensToReturn, ...tokens };
    return this;
  }

  private throwIfFailing() {
    if (this.failWith) {
      throw this.failWith;
    }
  }

  async exchangeCodeForTokens(
    code: string,
    redirect_uri: string,
  ): Promise<GoogleOAuthTokens> {
    this.throwIfFailing();
    this.exchangedCodes.push({ code, redirect_uri });
    return { ...this.tokensToReturn };
  }

  async refreshAccessToken(refresh_token: string): Promise<GoogleOAuthTokens> {
    this.throwIfFailing();
    this.refreshedTokens.push(refresh_token);
    return {
      access_token: this.tokensToReturn.access_token,
      expires_in: this.tokensToReturn.expires_in,
      scope: this.tokensToReturn.scope,
    };
  }

  async revokeToken(token: string): Promise<void> {
    this.throwIfFailing();
    this.revokedTokens.push(token);
  }

  async createEvent(
    input: GoogleCalendarEventInput,
  ): Promise<CreateGoogleCalendarEventResult> {
    this.throwIfFailing();
    this.createdEvents.push(input);
    return {
      google_event_id:
        input.event_id ?? `fake-google-event-${this.nextEventId++}`,
    };
  }

  async updateEvent(
    input: GoogleCalendarEventInput & { google_event_id: string },
  ): Promise<void> {
    this.throwIfFailing();
    this.updatedEvents.push(input);
  }

  async deleteEvent(input: {
    access_token: string;
    calendar_id: string;
    google_event_id: string;
  }): Promise<void> {
    this.throwIfFailing();
    this.deletedEvents.push(input);
  }
}
