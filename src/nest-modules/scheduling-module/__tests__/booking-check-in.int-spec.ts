import { ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { Band, BandId } from "../../../core/musician/domain/band.aggregate";
import { BandInMemoryRepository } from "../../../core/musician/infra/db/in-memory/band-in-memory.repository";
import { CancelBookingUseCase } from "../../../core/scheduling/application/use-cases/cancel-booking/cancel-booking.use-case";
import { CheckInBookingUseCase } from "../../../core/scheduling/application/use-cases/check-in-booking/check-in-booking.use-case";
import { ConfirmBookingUseCase } from "../../../core/scheduling/application/use-cases/confirm-booking/confirm-booking.use-case";
import { DisputeBookingUseCase } from "../../../core/scheduling/application/use-cases/dispute-booking/dispute-booking.use-case";
import { GetBookingUseCase } from "../../../core/scheduling/application/use-cases/get-booking/get-booking.use-case";
import { ListBookingsUseCase } from "../../../core/scheduling/application/use-cases/list-bookings/list-bookings.use-case";
import { ProposeBookingUseCase } from "../../../core/scheduling/application/use-cases/propose-booking/propose-booking.use-case";
import { Booking } from "../../../core/scheduling/domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../core/scheduling/infra/db/in-memory/booking-in-memory.repository";
import { Uuid } from "../../../core/shared/domain/value-objects/uuid.vo";
import { AuthenticatedUser } from "../../auth-module/interfaces/authenticated-user.interface";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { BookingsController } from "../bookings.controller";

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const BAND_ID = "33333333-3333-4333-8333-333333333333";

const START = new Date("2026-09-12T23:00:00Z");
const END = new Date("2026-09-13T01:30:00Z");
const DURANTE = new Date("2026-09-12T23:30:00Z");

function userAs(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    userId: MUSICIAN_ID,
    roles: ["musician"],
    establishmentIds: [],
    bandIds: [],
    isAdmin: false,
    ...overrides,
  } as AuthenticatedUser;
}

/**
 * Check-in e contestação atravessando o controller.
 *
 * O valor deste arquivo é a FRONTEIRA: os use-cases já são testados com input
 * montado em memória, e é exatamente aí que o 9.7 mostrou que os defeitos não
 * aparecem. Aqui se prova que o controller deriva a identidade do TOKEN — que é
 * o que separa "o dono registrou o show dele" de "qualquer um registrou o show
 * de qualquer um".
 */
describe("BookingsController — check-in e contestação (F1.3a)", () => {
  let controller: BookingsController;
  let bookingRepo: BookingInMemoryRepository;
  let bandRepo: BandInMemoryRepository;

  beforeEach(async () => {
    bookingRepo = new BookingInMemoryRepository();
    bandRepo = new BandInMemoryRepository();
    const clock = { now: () => DURANTE };

    const builder = Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: CheckInBookingUseCase,
          useFactory: () =>
            new CheckInBookingUseCase(bookingRepo, bandRepo, clock),
        },
        {
          provide: DisputeBookingUseCase,
          useFactory: () => new DisputeBookingUseCase(bookingRepo, clock),
        },
        /*
         * Injetados pelo controller por token de CLASSE. Declará-los é metade
         * do valor deste teste: se o controller passar a injetar algo que os
         * providers do módulo não fornecem, isto quebra antes do container real.
         */
        ...[
          ListBookingsUseCase,
          GetBookingUseCase,
          ProposeBookingUseCase,
          ConfirmBookingUseCase,
          CancelBookingUseCase,
        ].map((useCase) => ({ provide: useCase, useValue: {} })),
      ],
    });

    const module = await applyAuthGuardMocks(builder as any).compile();
    controller = module.get(BookingsController);
  });

  async function seedConfirmado(
    overrides: { band?: boolean } = {},
  ): Promise<Booking> {
    const booking = Booking.create({
      establishment_id: ESTABLISHMENT_ID,
      musician_id: overrides.band ? null : MUSICIAN_ID,
      band_id: overrides.band ? BAND_ID : null,
      start_at: START,
      end_at: END,
      fee: 1500,
    });
    booking.confirm(new Date("2026-09-01T12:00:00Z"));
    await bookingRepo.insert(booking);
    return booking;
  }

  describe("POST /scheduling/bookings/:id/check-in", () => {
    it("registra com a hora do servidor e devolve no presenter", async () => {
      const booking = await seedConfirmado();

      const result = await controller.checkIn(
        booking.booking_id.id,
        userAs({ userId: MUSICIAN_ID }),
      );

      expect(result.checked_in_at).toEqual(DURANTE);
      expect(result.checked_in_by).toBe("musician");
    });

    it("marca `band` quando o show é da banda — e exige o LÍDER", async () => {
      /*
       * A banda precisa existir no repositório com este músico como líder:
       * `assertNegotiationParticipant` é fail-closed quando não consegue provar
       * a liderança. Declarar em nome de quem tocou é ato do líder, mesma regra
       * de confirmar e cancelar.
       */
      const band = Band.create({
        name: "Trio Maré",
        genres: ["mpb"],
        members: [
          {
            musician_id: new Uuid(MUSICIAN_ID),
            role: "leader",
            instrument: "voz",
            status: "accepted",
            joined_at: new Date("2026-01-01T00:00:00.000Z"),
            responded_at: null,
          },
        ],
      });
      band.band_id = new BandId(BAND_ID);
      await bandRepo.insert(band);

      const booking = await seedConfirmado({ band: true });

      const result = await controller.checkIn(
        booking.booking_id.id,
        userAs({ userId: MUSICIAN_ID, bandIds: [BAND_ID] }),
      );

      expect(result.checked_in_by).toBe("band");
    });

    it("o estabelecimento também registra", async () => {
      const booking = await seedConfirmado();

      const result = await controller.checkIn(
        booking.booking_id.id,
        userAs({
          userId: "44444444-4444-4444-8444-444444444444",
          roles: ["establishment"],
          establishmentIds: [ESTABLISHMENT_ID],
        }),
      );

      expect(result.checked_in_at).toEqual(DURANTE);
    });

    it("403 para quem não é parte, sem gravar nada", async () => {
      const booking = await seedConfirmado();

      await expect(
        controller.checkIn(
          booking.booking_id.id,
          userAs({ userId: "99999999-9999-4999-8999-999999999999" }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const persisted = await bookingRepo.findById(booking.booking_id);
      expect(persisted!.isCheckedIn).toBe(false);
    });
  });

  describe("POST /scheduling/bookings/:id/dispute", () => {
    it("o estabelecimento contesta e o motivo volta no presenter", async () => {
      const booking = await seedConfirmado();

      const result = await controller.dispute(
        booking.booking_id.id,
        { reason: "banda tocou 40 minutos" },
        userAs({
          userId: "44444444-4444-4444-8444-444444444444",
          roles: ["establishment"],
          establishmentIds: [ESTABLISHMENT_ID],
        }),
      );

      expect(result.disputed_at).toEqual(DURANTE);
      expect(result.dispute_reason).toBe("banda tocou 40 minutos");
    });

    it("🔴 403 para o músico — ninguém trava o próprio pagamento", async () => {
      const booking = await seedConfirmado();

      await expect(
        controller.dispute(
          booking.booking_id.id,
          { reason: "quero segurar meu cachê" },
          userAs({ userId: MUSICIAN_ID }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const persisted = await bookingRepo.findById(booking.booking_id);
      expect(persisted!.isDisputed).toBe(false);
    });
  });
});
