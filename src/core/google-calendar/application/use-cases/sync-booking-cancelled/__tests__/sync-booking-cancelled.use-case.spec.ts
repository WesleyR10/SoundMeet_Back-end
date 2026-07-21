import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { FakeEncryptionService } from "../../../../../shared/infra/crypto/fake-encryption.service";
import { GoogleCalendarIntegration } from "../../../../domain/google-calendar-integration.aggregate";
import { GoogleCalendarSyncedEvent } from "../../../../domain/google-calendar-synced-event.aggregate";
import { GoogleCalendarIntegrationInMemoryRepository } from "../../../../infra/db/in-memory/google-calendar-integration-in-memory.repository";
import { GoogleCalendarSyncedEventInMemoryRepository } from "../../../../infra/db/in-memory/google-calendar-synced-event-in-memory.repository";
import { FakeGoogleCalendarGateway } from "../../../../infra/http/fake-google-calendar.gateway";
import { GoogleCalendarUnavailableError } from "../../../ports/google-calendar-gateway.interface";
import { GoogleCalendarTokenService } from "../../../services/google-calendar-token.service";
import { SyncBookingCancelledToGoogleCalendarUseCase } from "../sync-booking-cancelled.use-case";

describe("SyncBookingCancelledToGoogleCalendarUseCase", () => {
  let integrationRepo: GoogleCalendarIntegrationInMemoryRepository;
  let syncedEventRepo: GoogleCalendarSyncedEventInMemoryRepository;
  let gateway: FakeGoogleCalendarGateway;
  let encryption: FakeEncryptionService;
  let useCase: SyncBookingCancelledToGoogleCalendarUseCase;

  beforeEach(() => {
    integrationRepo = new GoogleCalendarIntegrationInMemoryRepository();
    syncedEventRepo = new GoogleCalendarSyncedEventInMemoryRepository();
    gateway = new FakeGoogleCalendarGateway();
    encryption = new FakeEncryptionService();
    useCase = new SyncBookingCancelledToGoogleCalendarUseCase(
      integrationRepo,
      syncedEventRepo,
      gateway,
      new GoogleCalendarTokenService(integrationRepo, gateway, encryption),
    );
  });

  const seedSyncedPair = () => {
    const musicianId = new Uuid();
    const integration = GoogleCalendarIntegration.fake()
      .aGoogleCalendarIntegration()
      .withMusicianId(musicianId)
      .withAccessTokenEncrypted(encryption.encrypt("valid-access"))
      .withRefreshTokenEncrypted(encryption.encrypt("valid-refresh"))
      .withTokenExpiresAt(new Date(Date.now() + 3600_000))
      .build();
    integrationRepo.items.push(integration);

    const bookingId = new Uuid();
    const syncedEvent = GoogleCalendarSyncedEvent.fake()
      .aGoogleCalendarSyncedEvent()
      .withBookingId(bookingId)
      .withMusicianId(musicianId)
      .withStatus("synced")
      .withGoogleEventId("google-event-xyz")
      .build();
    syncedEventRepo.items.push(syncedEvent);

    return { musicianId, bookingId, syncedEvent };
  };

  it("remove o evento da agenda registrada na criação e marca deleted", async () => {
    const { bookingId } = seedSyncedPair();

    const output = await useCase.execute({ booking_id: bookingId.id });

    expect(output).toEqual({ deleted: true, skipped_reason: null });
    expect(gateway.deletedEvents).toEqual([
      {
        access_token: "valid-access",
        calendar_id: "primary",
        google_event_id: "google-event-xyz",
      },
    ]);
    const record = await syncedEventRepo.findByBookingId(bookingId.id);
    expect(record!.status).toBe("deleted");
  });

  it("no-op quando nada foi sincronizado (cancelamento antes da confirmação)", async () => {
    const output = await useCase.execute({ booking_id: new Uuid().id });

    expect(output).toEqual({ deleted: false, skipped_reason: "never_synced" });
    expect(gateway.deletedEvents).toHaveLength(0);
  });

  it("no-op quando o registro já está deleted (replay idempotente)", async () => {
    const { bookingId, syncedEvent } = seedSyncedPair();
    syncedEvent.markDeleted();

    const output = await useCase.execute({ booking_id: bookingId.id });

    expect(output.skipped_reason).toBe("never_synced");
    expect(gateway.deletedEvents).toHaveLength(0);
  });

  it("no-op quando o músico desconectou depois do sync", async () => {
    const { bookingId, musicianId } = seedSyncedPair();
    const integration = await integrationRepo.findByMusicianId(musicianId.id);
    integration!.deactivate();

    const output = await useCase.execute({ booking_id: bookingId.id });

    expect(output.skipped_reason).toBe("not_connected");
    expect(gateway.deletedEvents).toHaveLength(0);
  });

  it("indisponibilidade do Google registra failed e propaga (retry pela fila)", async () => {
    const { bookingId } = seedSyncedPair();
    gateway.simulateUnavailable();

    await expect(useCase.execute({ booking_id: bookingId.id })).rejects.toThrow(
      GoogleCalendarUnavailableError,
    );

    const record = await syncedEventRepo.findByBookingId(bookingId.id);
    expect(record!.status).toBe("failed");
  });
});
