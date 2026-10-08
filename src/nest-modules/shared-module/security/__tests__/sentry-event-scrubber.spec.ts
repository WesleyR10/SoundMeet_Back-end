import { FILTERED, scrubSentryEvent } from "../sentry-event-scrubber";

describe("scrubSentryEvent", () => {
  it("filtra a senha do corpo JSON de POST /auth/login (o caso que motivou)", () => {
    const event = scrubSentryEvent({
      request: {
        data: JSON.stringify({ email: "a@b.com", password: "Senha123" }),
      },
    });

    const body = JSON.parse(event.request!.data as string);
    expect(body).toEqual({ email: "a@b.com", password: FILTERED });
  });

  it("filtra refresh token, CPF e celular — e recursivamente", () => {
    const event = scrubSentryEvent({
      request: {
        data: {
          refresh_token: "eyJ...",
          profile: { cpf: "12345678909", phone: "11999999999", name: "Ana" },
          items: [{ client_secret: "s" }],
        },
      },
    });

    expect(event.request!.data).toEqual({
      refresh_token: FILTERED,
      profile: { cpf: FILTERED, phone: FILTERED, name: "Ana" },
      items: [{ client_secret: FILTERED }],
    });
  });

  it("filtra form-urlencoded (o corpo que vai ao /token do Keycloak)", () => {
    const event = scrubSentryEvent({
      request: {
        data: "grant_type=password&username=a%40b.com&password=Senha123&client_secret=x",
      },
    });

    const params = new URLSearchParams(event.request!.data as string);
    expect(params.get("password")).toBe(FILTERED);
    expect(params.get("client_secret")).toBe(FILTERED);
    expect(params.get("username")).toBe("a@b.com");
  });

  it("filtra token na query (link de verificação de e-mail) e headers de credencial", () => {
    const event = scrubSentryEvent({
      request: {
        query_string: "token=abc&page=2",
        headers: {
          authorization: "Bearer x",
          "x-ai-cifra-token": "t",
          accept: "*/*",
        },
        cookies: { session: "s" },
      },
    });

    expect(event.request!.query_string).toBe(
      `token=${encodeURIComponent(FILTERED)}&page=2`,
    );
    expect(event.request!.headers).toEqual({
      authorization: FILTERED,
      "x-ai-cifra-token": FILTERED,
      accept: "*/*",
    });
    expect(event.request!.cookies).toBeUndefined();
  });

  it("descarta inteiro um corpo que não parseia mas menciona senha", () => {
    const event = scrubSentryEvent({ request: { data: "password: Senha123" } });
    expect(event.request!.data).toBe(FILTERED);
  });

  it("não mexe em evento sem request nem em corpo inofensivo", () => {
    expect(scrubSentryEvent({})).toEqual({});
    const event = scrubSentryEvent({
      request: { data: { page: 1, title: "x" } },
    });
    expect(event.request!.data).toEqual({ page: 1, title: "x" });
  });
});
