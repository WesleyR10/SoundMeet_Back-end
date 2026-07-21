import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { GoogleCalendarIntegration } from "../google-calendar-integration.aggregate";

const encrypted = (value: string) => ({
  ciphertext: Buffer.from(value).toString("base64"),
  iv: "iv",
  authTag: "tag",
});

const validCommand = () => ({
  musician_id: new Uuid().id,
  google_account_email: "musico@gmail.com",
  access_token_encrypted: encrypted("access"),
  refresh_token_encrypted: encrypted("refresh"),
  token_expires_at: new Date(Date.now() + 3600_000),
  scope: "https://www.googleapis.com/auth/calendar.events",
});

describe("GoogleCalendarIntegration", () => {
  describe("create", () => {
    it("cria integração ativa e válida", () => {
      const integration = GoogleCalendarIntegration.create(validCommand());

      expect(integration.notification.hasErrors()).toBe(false);
      expect(integration.is_active).toBe(true);
      expect(integration.isConnected).toBe(true);
      expect(integration.integration_id).toBeDefined();
    });

    it("acumula erro de validação com e-mail inválido", () => {
      const integration = GoogleCalendarIntegration.create({
        ...validCommand(),
        google_account_email: "nao-e-email",
      });

      expect(integration.notification.hasErrors()).toBe(true);
    });
  });

  describe("reconnect", () => {
    it("substitui tokens/conta e reativa preservando id e created_at", () => {
      const integration = GoogleCalendarIntegration.fake()
        .aGoogleCalendarIntegration()
        .deactivated()
        .build();
      const originalId = integration.integration_id.id;
      const originalCreatedAt = integration.created_at;

      integration.reconnect({
        google_account_email: "nova-conta@gmail.com",
        access_token_encrypted: encrypted("new-access"),
        refresh_token_encrypted: encrypted("new-refresh"),
        token_expires_at: new Date(Date.now() + 3600_000),
        scope: "https://www.googleapis.com/auth/calendar.events",
      });

      expect(integration.integration_id.id).toBe(originalId);
      expect(integration.created_at).toBe(originalCreatedAt);
      expect(integration.is_active).toBe(true);
      expect(integration.isConnected).toBe(true);
      expect(integration.google_account_email).toBe("nova-conta@gmail.com");
    });
  });

  describe("refreshAccessToken", () => {
    it("atualiza só o access token e a expiração", () => {
      const integration = GoogleCalendarIntegration.fake()
        .aGoogleCalendarIntegration()
        .build();
      const originalRefresh = integration.refresh_token_encrypted;
      const newExpiry = new Date(Date.now() + 7200_000);

      integration.refreshAccessToken(encrypted("new-access"), newExpiry);

      expect(integration.access_token_encrypted).toEqual(
        encrypted("new-access"),
      );
      expect(integration.token_expires_at).toBe(newExpiry);
      expect(integration.refresh_token_encrypted).toBe(originalRefresh);
    });
  });

  describe("deactivate", () => {
    it("zera todos os tokens e desativa (nunca reter segredo revogado)", () => {
      const integration = GoogleCalendarIntegration.fake()
        .aGoogleCalendarIntegration()
        .build();

      integration.deactivate();

      expect(integration.access_token_encrypted).toBeNull();
      expect(integration.refresh_token_encrypted).toBeNull();
      expect(integration.token_expires_at).toBeNull();
      expect(integration.is_active).toBe(false);
      expect(integration.isConnected).toBe(false);
      // E-mail preservado para histórico/suporte.
      expect(integration.google_account_email).toBeTruthy();
    });
  });

  describe("isTokenExpired", () => {
    it("expirado quando falta menos que a janela de segurança (60s)", () => {
      const integration = GoogleCalendarIntegration.fake()
        .aGoogleCalendarIntegration()
        .withTokenExpiresAt(new Date(Date.now() + 30_000))
        .build();

      expect(integration.isTokenExpired(new Date())).toBe(true);
    });

    it("válido quando sobra mais que a janela de segurança", () => {
      const integration = GoogleCalendarIntegration.fake()
        .aGoogleCalendarIntegration()
        .withTokenExpiresAt(new Date(Date.now() + 3600_000))
        .build();

      expect(integration.isTokenExpired(new Date())).toBe(false);
    });

    it("expirado quando não há expiração registrada", () => {
      const integration = GoogleCalendarIntegration.fake()
        .aGoogleCalendarIntegration()
        .withTokenExpiresAt(null)
        .build();

      expect(integration.isTokenExpired(new Date())).toBe(true);
    });
  });

  describe("toJSON", () => {
    it("nunca serializa os tokens cifrados", () => {
      const integration = GoogleCalendarIntegration.fake()
        .aGoogleCalendarIntegration()
        .build();

      const json = integration.toJSON();

      expect(JSON.stringify(json)).not.toContain("ciphertext");
      expect(json).not.toHaveProperty("access_token_encrypted");
      expect(json).not.toHaveProperty("refresh_token_encrypted");
    });
  });
});
