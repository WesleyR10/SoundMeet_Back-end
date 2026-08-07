import {
  BookingCollectionPresenter,
  BookingPresenter,
} from "../booking.presenter";
import { BookingsController } from "../bookings.controller";
import { InquiriesController } from "../inquiries.controller";
import {
  InquiryCollectionPresenter,
  InquiryPresenter,
} from "../inquiry.presenter";

const now = new Date("2026-06-19T12:00:00.000Z");

function bookingOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    establishment_id: "22222222-2222-4222-8222-222222222222",
    musician_id: "33333333-3333-4333-8333-333333333333",
    band_id: null,
    event_id: null,
    start_at: now,
    end_at: new Date("2026-06-19T14:00:00.000Z"),
    fee: 500,
    notes: "Soundcheck at 18h",
    status: "pending",
    buffer_minutes: 30,
    buffered_start_at: new Date("2026-06-19T11:30:00.000Z"),
    buffered_end_at: new Date("2026-06-19T14:30:00.000Z"),
    expires_at: null,
    free_cancellation_hours: 72,
    confirmed_at: null,
    cancelled_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function inquiryOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    establishment_id: "22222222-2222-4222-8222-222222222222",
    musician_id: "33333333-3333-4333-8333-333333333333",
    band_id: null,
    event_id: null,
    subject: "Show",
    initial_message: "Disponivel?",
    status: "pending",
    expires_at: null,
    accepted_at: null,
    rejected_at: null,
    rejection_reason: null,
    converted_at: null,
    booking_id: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function inject(controller: object, key: string, execute = jest.fn()) {
  (controller as any)[key] = { execute };
  return execute;
}

describe("Scheduling Controllers Unit Tests", () => {
  describe("BookingsController", () => {
    let controller: BookingsController;

    beforeEach(() => {
      controller = new BookingsController();
    });

    it("should propose booking through core use case", async () => {
      const execute = inject(
        controller,
        "proposeUseCase",
        jest.fn().mockResolvedValue(bookingOutput()),
      );

      const dto = {
        establishment_id: "22222222-2222-4222-8222-222222222222",
        musician_id: "33333333-3333-4333-8333-333333333333",
        start_at: now,
        end_at: new Date("2026-06-19T14:00:00.000Z"),
        fee: 500,
      };
      const presenter = await controller.propose(dto as any, {
        userId: "99999999-9999-4999-8999-999999999999",
        roles: ["establishment"],
        establishmentIds: ["22222222-2222-4222-8222-222222222222"],
        bandIds: [],
        isAdmin: false,
      });

      // A identidade do ator acompanha o comando — o use case recusa proposta
      // em nome de estabelecimento/músico que não seja do autenticado.
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          ...dto,
          requesting_participant_ids: [
            "99999999-9999-4999-8999-999999999999",
            "22222222-2222-4222-8222-222222222222",
          ],
          is_admin: false,
        }),
      );
      expect(presenter).toBeInstanceOf(BookingPresenter);
      expect(presenter.status).toBe("pending");
    });

    // Bloco 9.2 — o escopo vem do token, nunca da query.
    describe("leitura escopada", () => {
      const OWNER = {
        userId: "99999999-9999-4999-8999-999999999999",
        roles: ["musician"],
        establishmentIds: ["22222222-2222-4222-8222-222222222222"],
        bandIds: ["55555555-5555-4555-8555-555555555555"],
        isAdmin: false,
      };

      function page(items: unknown[]) {
        return {
          items,
          total: items.length,
          current_page: 1,
          per_page: 15,
          last_page: 1,
        };
      }

      it("lista enviando TODAS as identidades do token para o use case", async () => {
        const execute = inject(
          controller,
          "listUseCase",
          jest.fn().mockResolvedValue(page([bookingOutput()])),
        );

        const presenter = await controller.search({} as any, OWNER as any);

        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            requesting_participant_ids: [
              OWNER.userId,
              ...OWNER.establishmentIds,
              ...OWNER.bandIds,
            ],
            is_admin: false,
          }),
        );
        expect(presenter).toBeInstanceOf(BookingCollectionPresenter);
      });

      // Defesa em profundidade: o ValidationPipe global (whitelist: true) já
      // removeria estes campos da query, mas a ordem do spread garante que,
      // mesmo se algum dia passassem, a identidade do token prevalece.
      it("ignora tentativa de forjar escopo pela query", async () => {
        const execute = inject(
          controller,
          "listUseCase",
          jest.fn().mockResolvedValue(page([])),
        );

        await controller.search(
          {
            requesting_participant_ids: [
              "00000000-0000-4000-8000-000000000000",
            ],
            is_admin: true,
          } as any,
          OWNER as any,
        );

        const arg = execute.mock.calls[0][0];
        expect(arg.requesting_participant_ids).not.toContain(
          "00000000-0000-4000-8000-000000000000",
        );
        expect(arg.is_admin).toBe(false);
      });

      it("detalhe manda o sub separado, para o caso de banda", async () => {
        const execute = inject(
          controller,
          "getUseCase",
          jest.fn().mockResolvedValue(bookingOutput()),
        );

        const presenter = await controller.findOne(
          "11111111-1111-4111-8111-111111111111",
          OWNER as any,
        );

        expect(execute).toHaveBeenCalledWith(
          expect.objectContaining({
            booking_id: "11111111-1111-4111-8111-111111111111",
            requesting_musician_id: OWNER.userId,
            is_admin: false,
          }),
        );
        expect(presenter).toBeInstanceOf(BookingPresenter);
      });
    });

    it("should confirm booking using route id", async () => {
      const execute = inject(
        controller,
        "confirmUseCase",
        jest.fn().mockResolvedValue(bookingOutput({ status: "confirmed" })),
      );

      const currentUser = {
        userId: "22222222-2222-4222-8222-222222222222",
        roles: ["establishment"],
        establishmentIds: ["22222222-2222-4222-8222-222222222222"],
        bandIds: [],
        isAdmin: false,
      };

      const presenter = await controller.confirm(
        "11111111-1111-4111-8111-111111111111",
        currentUser,
      );

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_id: "11111111-1111-4111-8111-111111111111",
        }),
      );
      expect(presenter.status).toBe("confirmed");
    });
  });

  describe("InquiriesController", () => {
    let controller: InquiriesController;

    beforeEach(() => {
      controller = new InquiriesController();
    });

    it("should accept inquiry using route id", async () => {
      const execute = inject(
        controller,
        "acceptInquiryUseCase",
        jest.fn().mockResolvedValue(inquiryOutput({ status: "accepted" })),
      );

      const currentUser = {
        userId: "33333333-3333-4333-8333-333333333333",
        roles: ["musician"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      };

      const presenter = await controller.accept(
        "44444444-4444-4444-8444-444444444444",
        {} as any,
        currentUser,
      );

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          inquiry_id: "44444444-4444-4444-8444-444444444444",
        }),
      );
      expect(presenter).toBeInstanceOf(InquiryPresenter);
      expect(presenter.status).toBe("accepted");
    });

    it("should convert inquiry to booking preserving body fields", async () => {
      const execute = inject(
        controller,
        "convertInquiryToBookingUseCase",
        jest.fn().mockResolvedValue(bookingOutput()),
      );

      const presenter = await controller.convertToBooking(
        "44444444-4444-4444-8444-444444444444",
        {
          start_at: now,
          end_at: new Date("2026-06-19T14:00:00.000Z"),
          fee: 500,
          notes: "Contrato fechado",
          buffer_minutes: 30,
        } as any,
        {
          userId: "33333333-3333-4333-8333-333333333333",
          roles: ["musician"],
          establishmentIds: [],
          bandIds: [],
          isAdmin: false,
        },
      );

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          inquiry_id: "44444444-4444-4444-8444-444444444444",
          fee: 500,
          notes: "Contrato fechado",
          requesting_participant_ids: ["33333333-3333-4333-8333-333333333333"],
          is_admin: false,
        }),
      );
      expect(presenter).toBeInstanceOf(BookingPresenter);
    });

    it("lista propostas com o escopo derivado do token", async () => {
      const execute = inject(
        controller,
        "listInquiriesUseCase",
        jest.fn().mockResolvedValue({
          items: [inquiryOutput()],
          total: 1,
          current_page: 1,
          per_page: 15,
          last_page: 1,
        }),
      );

      const presenter = await controller.search(
        {} as any,
        {
          userId: "33333333-3333-4333-8333-333333333333",
          roles: ["musician"],
          establishmentIds: [],
          bandIds: ["55555555-5555-4555-8555-555555555555"],
          isAdmin: false,
        } as any,
      );

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          requesting_participant_ids: [
            "33333333-3333-4333-8333-333333333333",
            "55555555-5555-4555-8555-555555555555",
          ],
          is_admin: false,
        }),
      );
      expect(presenter).toBeInstanceOf(InquiryCollectionPresenter);
    });
  });
});
