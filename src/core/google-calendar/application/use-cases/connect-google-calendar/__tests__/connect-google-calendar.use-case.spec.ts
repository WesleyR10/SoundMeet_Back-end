import { ExternalServiceError } from "../../../../../shared/domain/errors/external-service.error";
import { InvalidArgumentError } from "../../../../../shared/domain/errors/invalid-argument.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { FakeEncryptionService } from "../../../../../shared/infra/crypto/fake-encryption.service";
import { GoogleCalendarIntegration } from "../../../../domain/google-calendar-integration.aggregate";
import { GoogleCalendarIntegrationInMemoryRepository } from "../../../../infra/db/in-memory/google-calendar-integration-in-memory.repository";
import { FakeGoogleCalendarGateway } from "../../../../infra/http/fake-google-calendar.gateway";
import { ConnectGoogleCalendarUseCase } from "../connect-google-calendar.use-case";

describe("ConnectGoogleCalendarUseCase", () => {
  let repo: GoogleCalendarIntegrationInMemoryRepository;
  let gateway: FakeGoogleCalendarGateway;
  let encryption: FakeEncryptionService;
  let useCase: ConnectGoogleCalendarUseCase;

  const musician_id = new Uuid().id;
  const input = () => ({
    musician_id,
    code: "auth-code-123",
    redirect_uri: "http://localhost:3000/api/v1/google-calendar/oauth/callback",
  });

  beforeEach(() => {
    repo = new GoogleCalendarIntegrationInMemoryRepository();
    gateway = new FakeGoogleCalendarGateway();
    encryption = new FakeEncryptionService();
    useCase = new ConnectGoogleCalendarUseCase(repo, gateway, encryption);
  });

  it("troca o code, cifra os tokens e persiste integração nova", async () => {
    const output = await useCase.execute(input());

    expect(output).toEqual({
      connected: true,
      google_account_email: "musico@gmail.com",
    });
    expect(gateway.exchangedCodes).toEqual([
      { code: "auth-code-123", redirect_uri: input().redirect_uri },
    ]);

    const persisted = await repo.findByMusicianId(musician_id);
    expect(persisted).not.toBeNull();
    expect(persisted!.is_active).toBe(true);
    // Tokens persistidos cifrados — nunca em texto claro.
    expect(encryption.encrypted).toEqual(
      expect.arrayContaining(["fake-access-token", "fake-refresh-token"]),
    );
    expect(encryption.decrypt(persisted!.refresh_token_encrypted!)).toBe(
      "fake-refresh-token",
    );
  });

  it("reconexão faz upsert na linha existente (mesmo id, tokens novos)", async () => {
    const existing = GoogleCalendarIntegration.fake()
      .aGoogleCalendarIntegration()
      .withMusicianId(new Uuid(musician_id))
      .deactivated()
      .build();
    repo.items.push(existing);
    gateway.setTokens({ email: "outra-conta@gmail.com" });

    const output = await useCase.execute(input());

    expect(output.google_account_email).toBe("outra-conta@gmail.com");
    expect(repo.items).toHaveLength(1);
    expect(repo.items[0].integration_id.id).toBe(existing.integration_id.id);
    expect(repo.items[0].is_active).toBe(true);
  });

  it("rejeita com 422 quando o Google não retorna refresh token", async () => {
    gateway.setTokens({ refresh_token: undefined });

    await expect(useCase.execute(input())).rejects.toThrow(
      InvalidArgumentError,
    );
    expect(repo.items).toHaveLength(0);
  });

  it("code inválido/expirado vira InvalidArgumentError (422), não 500", async () => {
    gateway.simulateAuthError();

    await expect(useCase.execute(input())).rejects.toThrow(
      InvalidArgumentError,
    );
  });

  it("Google fora do ar vira ExternalServiceError (503)", async () => {
    gateway.simulateUnavailable();

    await expect(useCase.execute(input())).rejects.toThrow(
      ExternalServiceError,
    );
  });
});
