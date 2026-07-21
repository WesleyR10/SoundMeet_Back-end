import { Band } from "../../../../../musician/domain/band.aggregate";
import { BandInMemoryRepository } from "../../../../../musician/infra/db/in-memory/band-in-memory.repository";
import { Booking } from "../../../../../scheduling/domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../../scheduling/infra/db/in-memory/booking-in-memory.repository";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { FakeEncryptionService } from "../../../../../shared/infra/crypto/fake-encryption.service";
import { GoogleCalendarIntegration } from "../../../../domain/google-calendar-integration.aggregate";
import { GoogleCalendarSyncedEvent } from "../../../../domain/google-calendar-synced-event.aggregate";
import { GoogleCalendarIntegrationInMemoryRepository } from "../../../../infra/db/in-memory/google-calendar-integration-in-memory.repository";
import { GoogleCalendarSyncedEventInMemoryRepository } from "../../../../infra/db/in-memory/google-calendar-synced-event-in-memory.repository";
import { FakeGoogleCalendarGateway } from "../../../../infra/http/fake-google-calendar.gateway";
import {
  GoogleCalendarAuthError,
  GoogleCalendarUnavailableError,
} from "../../../ports/google-calendar-gateway.interface";
import { GoogleCalendarTokenService } from "../../../services/google-calendar-token.service";
import { SyncBookingConfirmedToGoogleCalendarUseCase } from "../sync-booking-confirmed.use-case";

describe("SyncBookingConfirmedToGoogleCalendarUseCase", () => {
  let bookingRepo: BookingInMemoryRepository;
  let bandRepo: BandInMemoryRepository;
  let integrationRepo: GoogleCalendarIntegrationInMemoryRepository;
  let syncedEventRepo: GoogleCalendarSyncedEventInMemoryRepository;
  let gateway: FakeGoogleCalendarGateway;
  let encryption: FakeEncryptionService;
  let useCase: SyncBookingConfirmedToGoogleCalendarUseCase;

  beforeEach(() => {
    bookingRepo = new BookingInMemoryRepository();
    bandRepo = new BandInMemoryRepository();
    integrationRepo = new GoogleCalendarIntegrationInMemoryRepository();
    syncedEventRepo = new GoogleCalendarSyncedEventInMemoryRepository();
    gateway = new FakeGoogleCalendarGateway();
    encryption = new FakeEncryptionService();
    useCase = new SyncBookingConfirmedToGoogleCalendarUseCase(
      bookingRepo,
      bandRepo,
      integrationRepo,
      syncedEventRepo,
      gateway,
      new GoogleCalendarTokenService(integrationRepo, gateway, encryption),
      null,
    );
  });

  const seedIntegration = (musicianId: string) => {
    const integration = GoogleCalendarIntegration.fake()
      .aGoogleCalendarIntegration()
      .withMusicianId(new Uuid(musicianId))
      .withAccessTokenEncrypted(encryption.encrypt("valid-access"))
      .withRefreshTokenEncrypted(encryption.encrypt("valid-refresh"))
      .withTokenExpiresAt(new Date(Date.now() + 3600_000))
      .build();
    integrationRepo.items.push(integration);
    return integration;
  };

  const seedConfirmedBooking = (props: {
    musician_id?: string | null;
    band_id?: string | null;
  }) => {
    const booking = Booking.fake()
      .aBooking()
      .withMusicianId(props.musician_id ?? null)
      .withBandId(props.band_id ?? null)
      .confirmed()
      .build();
    bookingRepo.items.push(booking);
    return booking;
  };

  it("cria evento na agenda do músico com id determinístico e marca synced", async () => {
    const musicianId = new Uuid().id;
    seedIntegration(musicianId);
    const booking = seedConfirmedBooking({ musician_id: musicianId });

    const output = await useCase.execute({
      booking_id: booking.booking_id.id,
    });

    const expectedEventId = booking.booking_id.id
      .replace(/-/g, "")
      .toLowerCase();
    expect(output.synced).toBe(true);
    expect(output.google_event_id).toBe(expectedEventId);
    expect(gateway.createdEvents).toHaveLength(1);
    expect(gateway.createdEvents[0]).toMatchObject({
      calendar_id: "primary",
      event_id: expectedEventId,
      access_token: "valid-access",
      start_at: booking.start_at,
      end_at: booking.end_at,
    });

    const record = await syncedEventRepo.findByBookingId(booking.booking_id.id);
    expect(record!.status).toBe("synced");
    expect(record!.musician_id.id).toBe(musicianId);
  });

  it("resolve o líder em booking de banda e sincroniza a agenda dele", async () => {
    const leaderId = new Uuid();
    const band = Band.fake()
      .aBand()
      .withMembers([
        {
          musician_id: new Uuid(),
          role: "member",
          instrument: "baixo",
          status: "accepted",
          joined_at: new Date(),
          responded_at: null,
        },
        {
          musician_id: leaderId,
          role: "leader",
          instrument: "vocal",
          status: "accepted",
          joined_at: new Date(),
          responded_at: null,
        },
      ])
      .build();
    bandRepo.items.push(band);
    seedIntegration(leaderId.id);
    const booking = seedConfirmedBooking({ band_id: band.band_id.id });

    const output = await useCase.execute({
      booking_id: booking.booking_id.id,
    });

    expect(output.synced).toBe(true);
    const record = await syncedEventRepo.findByBookingId(booking.booking_id.id);
    expect(record!.musician_id.id).toBe(leaderId.id);
  });

  it("no-op quando a banda não tem líder", async () => {
    const band = Band.fake()
      .aBand()
      .withMembers([
        {
          musician_id: new Uuid(),
          role: "member",
          instrument: "baixo",
          status: "accepted",
          joined_at: new Date(),
          responded_at: null,
        },
      ])
      .build();
    bandRepo.items.push(band);
    const booking = seedConfirmedBooking({ band_id: band.band_id.id });

    const output = await useCase.execute({
      booking_id: booking.booking_id.id,
    });

    expect(output).toEqual({
      synced: false,
      google_event_id: null,
      skipped_reason: "no_sync_target",
    });
    expect(gateway.createdEvents).toHaveLength(0);
  });

  it("no-op (estado normal) quando o músico não conectou o Google", async () => {
    const booking = seedConfirmedBooking({ musician_id: new Uuid().id });

    const output = await useCase.execute({
      booking_id: booking.booking_id.id,
    });

    expect(output.skipped_reason).toBe("not_connected");
    expect(gateway.createdEvents).toHaveLength(0);
  });

  it("no-op quando o booking não está mais confirmado (cancelado antes do consumo)", async () => {
    const musicianId = new Uuid().id;
    seedIntegration(musicianId);
    const booking = Booking.fake()
      .aBooking()
      .withMusicianId(musicianId)
      .confirmed()
      .build();
    booking.cancel(
      new Date(booking.start_at.getTime() - 100 * 3600_000),
      "musician",
    );
    bookingRepo.items.push(booking);

    const output = await useCase.execute({
      booking_id: booking.booking_id.id,
    });

    expect(output.skipped_reason).toBe("not_confirmed");
    expect(gateway.createdEvents).toHaveLength(0);
  });

  it("replay idempotente: já sincronizado não chama o Google de novo", async () => {
    const musicianId = new Uuid().id;
    seedIntegration(musicianId);
    const booking = seedConfirmedBooking({ musician_id: musicianId });
    const existing = GoogleCalendarSyncedEvent.fake()
      .aGoogleCalendarSyncedEvent()
      .withBookingId(booking.booking_id)
      .withMusicianId(new Uuid(musicianId))
      .synced()
      .build();
    syncedEventRepo.items.push(existing);

    const output = await useCase.execute({
      booking_id: booking.booking_id.id,
    });

    expect(output.synced).toBe(true);
    expect(output.skipped_reason).toBe("already_synced");
    expect(gateway.createdEvents).toHaveLength(0);
  });

  it("lança NotFoundError (não-retriável) quando o booking não existe", async () => {
    await expect(
      useCase.execute({ booking_id: new Uuid().id }),
    ).rejects.toThrow(NotFoundError);
  });

  it("indisponibilidade do Google registra failed e propaga (retry pela fila)", async () => {
    const musicianId = new Uuid().id;
    seedIntegration(musicianId);
    const booking = seedConfirmedBooking({ musician_id: musicianId });
    gateway.simulateUnavailable();

    await expect(
      useCase.execute({ booking_id: booking.booking_id.id }),
    ).rejects.toThrow(GoogleCalendarUnavailableError);

    const record = await syncedEventRepo.findByBookingId(booking.booking_id.id);
    expect(record!.status).toBe("failed");
    expect(record!.last_error).toBeTruthy();
  });

  it("token revogado desativa a integração, registra failed e propaga (não-retriável)", async () => {
    const musicianId = new Uuid().id;
    const integration = seedIntegration(musicianId);
    // Token expirado força refresh — que falhará com auth error.
    integration.token_expires_at = new Date(Date.now() - 1000);
    const booking = seedConfirmedBooking({ musician_id: musicianId });
    gateway.simulateAuthError();

    await expect(
      useCase.execute({ booking_id: booking.booking_id.id }),
    ).rejects.toThrow(GoogleCalendarAuthError);

    const persisted = await integrationRepo.findByMusicianId(musicianId);
    expect(persisted!.is_active).toBe(false);
    const record = await syncedEventRepo.findByBookingId(booking.booking_id.id);
    expect(record!.status).toBe("failed");
  });

  it("compensa a corrida: booking cancelado durante o create → deleta o evento órfão", async () => {
    const musicianId = new Uuid().id;
    seedIntegration(musicianId);
    const booking = seedConfirmedBooking({ musician_id: musicianId });

    // Simula o cancelamento concorrente: o gateway "cria" o evento e, antes
    // do re-check, o booking muda para cancelado no repositório.
    const originalCreate = gateway.createEvent.bind(gateway);
    jest.spyOn(gateway, "createEvent").mockImplementation(async (input) => {
      const result = await originalCreate(input);
      booking.cancel(
        new Date(booking.start_at.getTime() - 100 * 3600_000),
        "establishment",
      );
      return result;
    });

    const output = await useCase.execute({
      booking_id: booking.booking_id.id,
    });

    expect(output.skipped_reason).toBe("not_confirmed");
    expect(gateway.deletedEvents).toHaveLength(1);
    const record = await syncedEventRepo.findByBookingId(booking.booking_id.id);
    expect(record!.status).toBe("deleted");
  });

  it("usa o nome do estabelecimento no título quando o repositório é fornecido", async () => {
    const musicianId = new Uuid().id;
    seedIntegration(musicianId);
    const booking = seedConfirmedBooking({ musician_id: musicianId });

    const establishmentRepo = {
      findById: jest.fn().mockResolvedValue({ name: "Bar do Zé" }),
    } as any;
    useCase = new SyncBookingConfirmedToGoogleCalendarUseCase(
      bookingRepo,
      bandRepo,
      integrationRepo,
      syncedEventRepo,
      gateway,
      new GoogleCalendarTokenService(integrationRepo, gateway, encryption),
      establishmentRepo,
    );

    await useCase.execute({ booking_id: booking.booking_id.id });

    expect(gateway.createdEvents[0].summary).toBe("Show — Bar do Zé");
  });
});
