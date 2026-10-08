import { ConfigService } from "@nestjs/config";
import type { Response } from "express";

import { Uuid } from "../../../core/shared/domain/value-objects/uuid.vo";
import { GoogleCalendarController } from "../google-calendar.controller";
import { GoogleCalendarCallbackController } from "../google-calendar-callback.controller";
import { GoogleCalendarOAuthStateService } from "../google-calendar-oauth-state.service";

const CONFIG: Record<string, string> = {
  GOOGLE_CALENDAR_CLIENT_ID: "client-id-123",
  GOOGLE_CALENDAR_CLIENT_SECRET: "client-secret",
  GOOGLE_CALENDAR_REDIRECT_URI:
    "http://localhost:3000/api/v1/google-calendar/oauth/callback",
  GOOGLE_CALENDAR_APP_RETURN_URL: "soundmeet://agenda/google",
  JWT_SECRET: "test-secret",
};

const configStub = {
  get: (key: string) => CONFIG[key],
} as unknown as ConfigService;

const stateService = new GoogleCalendarOAuthStateService(CONFIG.JWT_SECRET);

describe("GoogleCalendarController", () => {
  const musician_id = new Uuid().id;

  const makeController = () => {
    const controller = new GoogleCalendarController(configStub);
    const getStatus = jest.fn().mockResolvedValue({
      connected: true,
      google_account_email: "musico@gmail.com",
    });
    const disconnect = jest.fn().mockResolvedValue({ disconnected: true });
    // @Inject por propriedade — substituição direta no teste unitário.
    controller["getStatusUseCase"] = { execute: getStatus } as any;
    controller["disconnectUseCase"] = { execute: disconnect } as any;
    controller["oauthStateService"] = stateService;
    return { controller, getStatus, disconnect };
  };

  describe("connect", () => {
    it("monta a URL de consentimento com escopo mínimo, offline+consent e state assinado", async () => {
      const { controller } = makeController();

      const output = await controller.connect(musician_id);
      const url = new URL(output.consent_url);

      expect(url.origin + url.pathname).toBe(
        "https://accounts.google.com/o/oauth2/v2/auth",
      );
      expect(url.searchParams.get("client_id")).toBe("client-id-123");
      expect(url.searchParams.get("redirect_uri")).toBe(
        CONFIG.GOOGLE_CALENDAR_REDIRECT_URI,
      );
      expect(url.searchParams.get("scope")).toBe(
        "https://www.googleapis.com/auth/calendar.events openid email",
      );
      expect(url.searchParams.get("access_type")).toBe("offline");
      expect(url.searchParams.get("prompt")).toBe("consent");

      const state = url.searchParams.get("state")!;
      expect(stateService.verify(state)).toEqual({ musician_id });
    });
  });

  describe("status", () => {
    it("delega pro use case e nunca expõe tokens", async () => {
      const { controller, getStatus } = makeController();

      const output = await controller.status(musician_id);

      expect(getStatus).toHaveBeenCalledWith({ musician_id });
      expect(output).toEqual({
        connected: true,
        google_account_email: "musico@gmail.com",
      });
    });
  });

  describe("disconnect", () => {
    it("delega pro use case", async () => {
      const { controller, disconnect } = makeController();

      const output = await controller.disconnect(musician_id);

      expect(disconnect).toHaveBeenCalledWith({ musician_id });
      expect(output).toEqual({ disconnected: true });
    });
  });
});

describe("GoogleCalendarCallbackController", () => {
  const musician_id = new Uuid().id;
  const RETURN_URL = CONFIG.GOOGLE_CALENDAR_APP_RETURN_URL;

  const makeController = () => {
    const controller = new GoogleCalendarCallbackController(configStub);
    const connect = jest.fn().mockResolvedValue({
      connected: true,
      google_account_email: "musico@gmail.com",
    });
    controller["connectUseCase"] = { execute: connect } as any;
    controller["oauthStateService"] = stateService;

    const redirect = jest.fn();
    const response = { redirect } as unknown as Response;

    return { controller, connect, response, redirect };
  };

  it("state válido: troca o code pro musician_id embutido e volta pro app", async () => {
    const { controller, connect, response, redirect } = makeController();
    const state = stateService.sign(musician_id);

    await controller.callback(response, "auth-code", state, undefined);

    expect(connect).toHaveBeenCalledWith({
      musician_id,
      code: "auth-code",
      redirect_uri: CONFIG.GOOGLE_CALENDAR_REDIRECT_URI,
    });
    expect(redirect).toHaveBeenCalledWith(`${RETURN_URL}?status=sucesso`);
  });

  it("state adulterado → volta com erro, sem tocar o Google", async () => {
    const { controller, connect, response, redirect } = makeController();

    await controller.callback(response, "auth-code", "estado.forjado", undefined);

    expect(connect).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(`${RETURN_URL}?status=erro`);
  });

  it("state ausente → volta com erro, sem tocar o Google", async () => {
    const { controller, connect, response, redirect } = makeController();

    await controller.callback(response, "auth-code", undefined, undefined);

    expect(connect).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(`${RETURN_URL}?status=erro`);
  });

  it("code ausente com state válido → volta com erro", async () => {
    const { controller, connect, response, redirect } = makeController();
    const state = stateService.sign(musician_id);

    await controller.callback(response, undefined, state, undefined);

    expect(connect).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(`${RETURN_URL}?status=erro`);
  });

  it("usuário negou o consentimento → status próprio, sem troca de code", async () => {
    const { controller, connect, response, redirect } = makeController();

    await controller.callback(response, undefined, undefined, "access_denied");

    expect(connect).not.toHaveBeenCalled();
    // `cancelado` e não `erro`: quem desistiu foi o usuário, e o app precisa
    // dizer isso com outras palavras (nada quebrou).
    expect(redirect).toHaveBeenCalledWith(`${RETURN_URL}?status=cancelado`);
  });

  it("falha na troca do code → volta com erro, sem vazar o motivo na URL", async () => {
    const { controller, connect, response, redirect } = makeController();
    connect.mockRejectedValue(new Error("invalid_grant: code já usado"));
    const state = stateService.sign(musician_id);

    await controller.callback(response, "auth-code", state, undefined);

    expect(redirect).toHaveBeenCalledWith(`${RETURN_URL}?status=erro`);
    const redirectUrl = redirect.mock.calls[0][0] as string;
    expect(redirectUrl).not.toContain("invalid_grant");
  });

  /*
   * 🔴 Esta é a razão de o e-mail NÃO viajar no redirect. Ele é PII e ficaria
   * no histórico do navegador e em qualquer log de proxy pelo caminho — quem
   * o entrega é o GET /status, autenticado. De quebra, sem HTML na resposta
   * não existe mais superfície de XSS aqui (o teste de escape que morava
   * neste arquivo deixou de ter o que testar).
   */
  it("nunca põe o e-mail da conta na URL de retorno", async () => {
    const { controller, connect, response, redirect } = makeController();
    connect.mockResolvedValue({
      connected: true,
      google_account_email: "musico@gmail.com",
    });
    const state = stateService.sign(musician_id);

    await controller.callback(response, "auth-code", state, undefined);

    const redirectUrl = redirect.mock.calls[0][0] as string;
    expect(redirectUrl).not.toContain("musico@gmail.com");
    expect(redirectUrl).not.toContain("gmail");
  });

  it("sem GOOGLE_CALENDAR_APP_RETURN_URL configurada, cai no deep link padrão", async () => {
    const semReturnUrl = {
      get: (key: string) =>
        key === "GOOGLE_CALENDAR_APP_RETURN_URL" ? undefined : CONFIG[key],
    } as unknown as ConfigService;
    const controller = new GoogleCalendarCallbackController(semReturnUrl);
    controller["connectUseCase"] = {
      execute: jest.fn().mockResolvedValue({
        connected: true,
        google_account_email: "musico@gmail.com",
      }),
    } as any;
    controller["oauthStateService"] = stateService;
    const redirect = jest.fn();

    await controller.callback(
      { redirect } as unknown as Response,
      "auth-code",
      stateService.sign(musician_id),
      undefined,
    );

    expect(redirect).toHaveBeenCalledWith("soundmeet://agenda/google?status=sucesso");
  });
});
