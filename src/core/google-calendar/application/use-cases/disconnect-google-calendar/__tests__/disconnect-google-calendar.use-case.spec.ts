import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { FakeEncryptionService } from "../../../../../shared/infra/crypto/fake-encryption.service";
import { GoogleCalendarIntegration } from "../../../../domain/google-calendar-integration.aggregate";
import { GoogleCalendarIntegrationInMemoryRepository } from "../../../../infra/db/in-memory/google-calendar-integration-in-memory.repository";
import { FakeGoogleCalendarGateway } from "../../../../infra/http/fake-google-calendar.gateway";
import { DisconnectGoogleCalendarUseCase } from "../disconnect-google-calendar.use-case";

describe("DisconnectGoogleCalendarUseCase", () => {
  let repo: GoogleCalendarIntegrationInMemoryRepository;
  let gateway: FakeGoogleCalendarGateway;
  let encryption: FakeEncryptionService;
  let useCase: DisconnectGoogleCalendarUseCase;

  beforeEach(() => {
    repo = new GoogleCalendarIntegrationInMemoryRepository();
    gateway = new FakeGoogleCalendarGateway();
    encryption = new FakeEncryptionService();
    useCase = new DisconnectGoogleCalendarUseCase(repo, gateway, encryption);
  });

  const seedIntegration = () => {
    const integration = GoogleCalendarIntegration.fake()
      .aGoogleCalendarIntegration()
      .withRefreshTokenEncrypted(encryption.encrypt("refresh-to-revoke"))
      .build();
    repo.items.push(integration);
    return integration;
  };

  it("revoga o token no Google e zera os tokens locais", async () => {
    const integration = seedIntegration();

    const output = await useCase.execute({
      musician_id: integration.musician_id.id,
    });

    expect(output).toEqual({ disconnected: true });
    expect(gateway.revokedTokens).toEqual(["refresh-to-revoke"]);
    const persisted = await repo.findByMusicianId(integration.musician_id.id);
    expect(persisted!.is_active).toBe(false);
    expect(persisted!.refresh_token_encrypted).toBeNull();
    expect(persisted!.access_token_encrypted).toBeNull();
  });

  it("Google fora do ar NÃO bloqueia o disconnect — tokens locais zerados mesmo assim", async () => {
    const integration = seedIntegration();
    gateway.simulateUnavailable();

    const output = await useCase.execute({
      musician_id: integration.musician_id.id,
    });

    expect(output).toEqual({ disconnected: true });
    const persisted = await repo.findByMusicianId(integration.musician_id.id);
    expect(persisted!.is_active).toBe(false);
    expect(persisted!.refresh_token_encrypted).toBeNull();
  });

  it("lança NotFoundError quando não há integração", async () => {
    await expect(
      useCase.execute({ musician_id: new Uuid().id }),
    ).rejects.toThrow(NotFoundError);
  });
});
