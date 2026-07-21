import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { GoogleCalendarSyncedEvent } from "../google-calendar-synced-event.aggregate";

describe("GoogleCalendarSyncedEvent", () => {
  it("cria com status pending", () => {
    const syncedEvent = GoogleCalendarSyncedEvent.create({
      booking_id: new Uuid().id,
      musician_id: new Uuid().id,
    });

    expect(syncedEvent.notification.hasErrors()).toBe(false);
    expect(syncedEvent.status).toBe("pending");
    expect(syncedEvent.isSynced).toBe(false);
  });

  it("markSynced registra o google_event_id e limpa erro anterior", () => {
    const syncedEvent = GoogleCalendarSyncedEvent.fake()
      .aGoogleCalendarSyncedEvent()
      .withStatus("failed")
      .withLastError("erro anterior")
      .build();

    syncedEvent.markSynced("google-event-abc");

    expect(syncedEvent.status).toBe("synced");
    expect(syncedEvent.google_event_id).toBe("google-event-abc");
    expect(syncedEvent.last_error).toBeNull();
    expect(syncedEvent.synced_at).toBeInstanceOf(Date);
    expect(syncedEvent.isSynced).toBe(true);
  });

  it("markFailed trunca mensagens de erro longas em 500 chars", () => {
    const syncedEvent = GoogleCalendarSyncedEvent.fake()
      .aGoogleCalendarSyncedEvent()
      .build();

    syncedEvent.markFailed("x".repeat(2000));

    expect(syncedEvent.status).toBe("failed");
    expect(syncedEvent.last_error).toHaveLength(500);
  });

  it("markDeleted finaliza o ciclo após cancelamento", () => {
    const syncedEvent = GoogleCalendarSyncedEvent.fake()
      .aGoogleCalendarSyncedEvent()
      .synced()
      .build();

    syncedEvent.markDeleted();

    expect(syncedEvent.status).toBe("deleted");
    expect(syncedEvent.isSynced).toBe(false);
  });
});
