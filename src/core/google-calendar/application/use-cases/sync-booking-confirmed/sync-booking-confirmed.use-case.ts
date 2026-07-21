import { EstablishmentId } from "../../../../establishment/domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../../establishment/domain/establishment.repository";
import { IBandRepository } from "../../../../musician/domain/band.repository";
import {
  Booking,
  BookingId,
} from "../../../../scheduling/domain/booking.aggregate";
import { IBookingRepository } from "../../../../scheduling/domain/booking.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { IGoogleCalendarIntegrationRepository } from "../../../domain/google-calendar-integration.repository";
import { GoogleCalendarSyncedEvent } from "../../../domain/google-calendar-synced-event.aggregate";
import { IGoogleCalendarSyncedEventRepository } from "../../../domain/google-calendar-synced-event.repository";
import {
  GoogleCalendarAuthError,
  GoogleCalendarUnavailableError,
  IGoogleCalendarGateway,
} from "../../ports/google-calendar-gateway.interface";
import { GoogleCalendarTokenService } from "../../services/google-calendar-token.service";
import { resolveBookingSyncMusicianId } from "../common/booking-sync-target.resolver";
import { SyncBookingConfirmedInput } from "./sync-booking-confirmed.input";

export type SyncBookingConfirmedOutput = {
  synced: boolean;
  google_event_id: string | null;
  skipped_reason:
    | "not_confirmed"
    | "no_sync_target"
    | "not_connected"
    | "already_synced"
    | null;
};

/**
 * Consumer-side: cria o evento no Google Calendar do músico (ou do líder da
 * banda) quando um booking é confirmado. Idempotente em três camadas:
 * dedupe de fila (messageId), registro `GoogleCalendarSyncedEvent` (status
 * synced = no-op) e id determinístico do evento no Google (409 = sucesso).
 */
export class SyncBookingConfirmedToGoogleCalendarUseCase implements IUseCase<
  SyncBookingConfirmedInput,
  SyncBookingConfirmedOutput
> {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly bandRepo: IBandRepository,
    private readonly integrationRepo: IGoogleCalendarIntegrationRepository,
    private readonly syncedEventRepo: IGoogleCalendarSyncedEventRepository,
    private readonly gateway: IGoogleCalendarGateway,
    private readonly tokenService: GoogleCalendarTokenService,
    private readonly establishmentRepo?: IEstablishmentRepository | null,
  ) {}

  async execute(
    input: SyncBookingConfirmedInput,
  ): Promise<SyncBookingConfirmedOutput> {
    const booking = await this.bookingRepo.findById(
      new BookingId(input.booking_id),
    );
    if (!booking) {
      throw new NotFoundError(input.booking_id, Booking);
    }

    // Booking pode ter sido cancelado entre o evento e o consumo — não criar.
    if (!booking.status.isConfirmed()) {
      return this.skip("not_confirmed");
    }

    const musicianId = await resolveBookingSyncMusicianId(
      booking,
      this.bandRepo,
    );
    if (!musicianId) {
      return this.skip("no_sync_target");
    }

    const integration = await this.integrationRepo.findByMusicianId(musicianId);
    if (!integration?.isConnected) {
      // Estado normal e esperado: músico simplesmente não conectou o Google.
      return this.skip("not_connected");
    }

    const existing = await this.syncedEventRepo.findByBookingId(
      input.booking_id,
    );
    if (existing?.isSynced) {
      return {
        synced: true,
        google_event_id: existing.google_event_id,
        skipped_reason: "already_synced",
      };
    }

    const syncedEvent =
      existing ??
      GoogleCalendarSyncedEvent.create({
        booking_id: input.booking_id,
        musician_id: musicianId,
      });

    try {
      const accessToken =
        await this.tokenService.getValidAccessToken(integration);

      const result = await this.gateway.createEvent({
        access_token: accessToken,
        calendar_id: "primary",
        event_id: this.deterministicEventId(input.booking_id),
        summary: await this.buildSummary(booking),
        description: this.buildDescription(booking),
        start_at: booking.start_at,
        end_at: booking.end_at,
      });

      syncedEvent.markSynced(result.google_event_id);
      await this.syncedEventRepo.upsert(syncedEvent);

      // Compensação da corrida entre filas: se o booking foi cancelado
      // enquanto criávamos o evento (o consumer de cancelamento pode ter
      // rodado antes e dado no-op em "never_synced"), remove o evento órfão.
      const recheck = await this.bookingRepo.findById(
        new BookingId(input.booking_id),
      );
      if (recheck && !recheck.status.isConfirmed()) {
        await this.gateway.deleteEvent({
          access_token: accessToken,
          calendar_id: "primary",
          google_event_id: result.google_event_id,
        });
        syncedEvent.markDeleted();
        await this.syncedEventRepo.upsert(syncedEvent);
        return this.skip("not_confirmed");
      }

      return {
        synced: true,
        google_event_id: result.google_event_id,
        skipped_reason: null,
      };
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

  /** UUID sem hífens = base32hex válido como id de evento no Google. */
  private deterministicEventId(bookingId: string): string {
    return bookingId.replace(/-/g, "").toLowerCase();
  }

  private async buildSummary(booking: Booking): Promise<string> {
    // Nome do estabelecimento é enriquecimento best-effort — nunca bloqueia.
    if (this.establishmentRepo) {
      try {
        const establishment = await this.establishmentRepo.findById(
          new EstablishmentId(booking.establishment_id.id),
        );
        if (establishment?.name) {
          return `Show — ${establishment.name}`;
        }
      } catch {
        // Sem nome, cai no título genérico.
      }
    }
    return "Show confirmado — SoundMeet";
  }

  private buildDescription(booking: Booking): string {
    const lines = ["Show confirmado via SoundMeet."];
    if (booking.notes) {
      lines.push(`Notas: ${booking.notes}`);
    }
    if (booking.fee !== null) {
      lines.push(`Cachê: R$ ${booking.fee.toFixed(2)}`);
    }
    return lines.join("\n");
  }

  private skip(
    reason: NonNullable<SyncBookingConfirmedOutput["skipped_reason"]>,
  ): SyncBookingConfirmedOutput {
    return { synced: false, google_event_id: null, skipped_reason: reason };
  }
}
