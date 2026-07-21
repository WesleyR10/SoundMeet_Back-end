import { FakeEncryptionService } from "../../../../shared/infra/crypto/fake-encryption.service";
import { GoogleCalendarIntegration } from "../../../domain/google-calendar-integration.aggregate";
import { GoogleCalendarIntegrationInMemoryRepository } from "../../../infra/db/in-memory/google-calendar-integration-in-memory.repository";
import { FakeGoogleCalendarGateway } from "../../../infra/http/fake-google-calendar.gateway";
import { GoogleCalendarAuthError } from "../../ports/google-calendar-gateway.interface";
import { GoogleCalendarTokenService } from "../google-calendar-token.service";

describe("GoogleCalendarTokenService", () => {
  let repo: GoogleCalendarIntegrationInMemoryRepository;
  let gateway: FakeGoogleCalendarGateway;
  let encryption: FakeEncryptionService;
  let service: GoogleCalendarTokenService;

  beforeEach(() => {
    repo = new GoogleCalendarIntegrationInMemoryRepository();
    gateway = new FakeGoogleCalendarGateway();
    encryption = new FakeEncryptionService();
    service = new GoogleCalendarTokenService(repo, gateway, encryption);
  });

  const buildIntegration = (expiresInMs: number) => {
    const integration = GoogleCalendarIntegration.fake()
      .aGoogleCalendarIntegration()
      .withAccessTokenEncrypted(encryption.encrypt("current-access"))
      .withRefreshTokenEncrypted(encryption.encrypt("current-refresh"))
      .withTokenExpiresAt(new Date(Date.now() + expiresInMs))
      .build();
    repo.items.push(integration);
    return integration;
  };

  it("retorna o access token atual quando ainda válido, sem chamar o Google", async () => {
    const integration = buildIntegration(3600_000);

    const token = await service.getValidAccessToken(integration);

    expect(token).toBe("current-access");
    expect(gateway.refreshedTokens).toHaveLength(0);
  });

  it("renova via refresh token quando expirado e persiste o novo token cifrado", async () => {
    const integration = buildIntegration(-1000);
    gateway.setTokens({ access_token: "brand-new-access", expires_in: 3600 });

    const token = await service.getValidAccessToken(integration);

    expect(token).toBe("brand-new-access");
    expect(gateway.refreshedTokens).toEqual(["current-refresh"]);
    const persisted = await repo.findByMusicianId(integration.musician_id.id);
    expect(encryption.decrypt(persisted!.access_token_encrypted!)).toBe(
      "brand-new-access",
    );
    expect(persisted!.isTokenExpired(new Date())).toBe(false);
  });

  it("desativa a integração e propaga quando o refresh token foi revogado", async () => {
    const integration = buildIntegration(-1000);
    gateway.simulateAuthError();

    await expect(service.getValidAccessToken(integration)).rejects.toThrow(
      GoogleCalendarAuthError,
    );

    const persisted = await repo.findByMusicianId(integration.musician_id.id);
    expect(persisted!.is_active).toBe(false);
    expect(persisted!.refresh_token_encrypted).toBeNull();
  });

  it("rejeita integração desconectada sem tocar o Google", async () => {
    const integration = GoogleCalendarIntegration.fake()
      .aGoogleCalendarIntegration()
      .deactivated()
      .build();
    repo.items.push(integration);

    await expect(service.getValidAccessToken(integration)).rejects.toThrow(
      GoogleCalendarAuthError,
    );
    expect(gateway.refreshedTokens).toHaveLength(0);
  });
});
