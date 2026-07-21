import { UnprocessableEntityException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Uuid } from "../../../core/shared/domain/value-objects/uuid.vo";
import { GoogleCalendarController } from "../google-calendar.controller";
import { GoogleCalendarCallbackController } from "../google-calendar-callback.controller";
import { GoogleCalendarOAuthStateService } from "../google-calendar-oauth-state.service";

const CONFIG: Record<string, string> = {
  GOOGLE_CALENDAR_CLIENT_ID: "client-id-123",
  GOOGLE_CALENDAR_CLIENT_SECRET: "client-secret",
  GOOGLE_CALENDAR_REDIRECT_URI:
    "http://localhost:3000/api/v1/google-calendar/oauth/callback",
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

  const makeController = () => {
    const controller = new GoogleCalendarCallbackController(configStub);
    const connect = jest.fn().mockResolvedValue({
      connected: true,
      google_account_email: "musico@gmail.com",
    });
    controller["connectUseCase"] = { execute: connect } as any;
    controller["oauthStateService"] = stateService;
    return { controller, connect };
  };

  it("state válido: troca o code pro musician_id embutido e retorna página de sucesso", async () => {
    const { controller, connect } = makeController();
    const state = stateService.sign(musician_id);

    const html = await controller.callback("auth-code", state, undefined);

    expect(connect).toHaveBeenCalledWith({
      musician_id,
      code: "auth-code",
      redirect_uri: CONFIG.GOOGLE_CALENDAR_REDIRECT_URI,
    });
    expect(html).toContain("Google Calendar conectado");
    expect(html).toContain("musico@gmail.com");
  });

  it("state adulterado → 422 sem tocar o Google", async () => {
    const { controller, connect } = makeController();

    await expect(
      controller.callback("auth-code", "estado.forjado", undefined),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(connect).not.toHaveBeenCalled();
  });

  it("state ausente → 422 sem tocar o Google", async () => {
    const { controller, connect } = makeController();

    await expect(
      controller.callback("auth-code", undefined, undefined),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(connect).not.toHaveBeenCalled();
  });

  it("code ausente com state válido → 422", async () => {
    const { controller, connect } = makeController();
    const state = stateService.sign(musician_id);

    await expect(
      controller.callback(undefined, state, undefined),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(connect).not.toHaveBeenCalled();
  });

  it("usuário negou o consentimento → página de cancelamento, sem troca de code", async () => {
    const { controller, connect } = makeController();

    const html = await controller.callback(
      undefined,
      undefined,
      "access_denied",
    );

    expect(html).toContain("Conexão cancelada");
    expect(connect).not.toHaveBeenCalled();
  });

  it("escapa HTML no e-mail da conta (defesa XSS na página de sucesso)", async () => {
    const { controller, connect } = makeController();
    connect.mockResolvedValue({
      connected: true,
      google_account_email: "<script>alert(1)</script>@gmail.com",
    });
    const state = stateService.sign(musician_id);

    const html = await controller.callback("auth-code", state, undefined);

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
