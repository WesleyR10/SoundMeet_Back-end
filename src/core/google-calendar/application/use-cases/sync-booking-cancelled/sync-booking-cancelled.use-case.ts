import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IGoogleCalendarIntegrationRepository } from "../../../domain/google-calendar-integration.repository";
import { IGoogleCalendarSyncedEventRepository } from "../../../domain/google-calendar-synced-event.repository";
import {
  GoogleCalendarAuthError,
  GoogleCalendarUnavailableError,
  IGoogleCalendarGateway,
} from "../../ports/google-calendar-gateway.interface";
import { GoogleCalendarTokenService } from "../../services/google-calendar-token.service";
import { SyncBookingCancelledInput } from "./sync-booking-cancelled.input";

export type SyncBookingCancelledOutput = {
  deleted: boolean;
  skipped_reason: "never_synced" | "not_connected" | null;
};

/**
 * Consumer-side: remove do Google Calendar o evento de um booking cancelado.
 *
 * A fonte autoritativa é o registro `GoogleCalendarSyncedEvent` — ele guarda
 * em qual agenda (musician_id da criação) e com qual id o evento existe.
 * Não re-resolve o líder da banda: se a liderança mudou entre confirmação e
 * cancelamento, o evento continua na agenda de quem era líder na criação.
 *
 * No-op quando nada foi sincronizado (cancelamento antes da confirmação,
 * músico sem conta conectada, ou booking hard-deletado — o cascade remove o
 * registro junto). 404/410 do Google conta como sucesso (adapter idempotente).
 */
export class SyncBookingCancelledToGoogleCalendarUseCase implements IUseCase<
  SyncBookingCancelledInput,
  SyncBookingCancelledOutput
> {
  constructor(
    private readonly integrationRepo: IGoogleCalendarIntegrationRepository,
    private readonly syncedEventRepo: IGoogleCalendarSyncedEventRepository,
    private readonly gateway: IGoogleCalendarGateway,
    private readonly tokenService: GoogleCalendarTokenService,
  ) {}

  async execute(
    input: SyncBookingCancelledInput,
  ): Promise<SyncBookingCancelledOutput> {
    const syncedEvent = await this.syncedEventRepo.findByBookingId(
      input.booking_id,
    );
    if (!syncedEvent?.google_event_id || syncedEvent.status === "deleted") {
      return { deleted: false, skipped_reason: "never_synced" };
    }

    const integration = await this.integrationRepo.findByMusicianId(
      syncedEvent.musician_id.id,
    );
    if (!integration?.isConnected) {
      return { deleted: false, skipped_reason: "not_connected" };
    }

    try {
      const accessToken =
        await this.tokenService.getValidAccessToken(integration);

      await this.gateway.deleteEvent({
        access_token: accessToken,
        calendar_id: "primary",
        google_event_id: syncedEvent.google_event_id,
      });

      syncedEvent.markDeleted();
      await this.syncedEventRepo.upsert(syncedEvent);

      return { deleted: true, skipped_reason: null };
    } catch (error) {
      if (
        error instanceof GoogleCalendarAuthError ||
        error instanceof GoogleCalendarUnavailableError
      ) {
        syncedEvent.markFailed(error.message);
        await this.syncedEventRepo.upsert(syncedEvent);
      }
      throw error;
    }
  }
}
