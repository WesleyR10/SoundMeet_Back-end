import { BookingPresenter } from "../booking.presenter";
import { BookingsController } from "../bookings.controller";
import { InquiriesController } from "../inquiries.controller";
import { InquiryPresenter } from "../inquiry.presenter";

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
      const presenter = await controller.propose(dto);

      expect(execute).toHaveBeenCalledWith(dto);
      expect(presenter).toBeInstanceOf(BookingPresenter);
      expect(presenter.status).toBe("pending");
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
      );

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          inquiry_id: "44444444-4444-4444-8444-444444444444",
          fee: 500,
          notes: "Contrato fechado",
        }),
      );
      expect(presenter).toBeInstanceOf(BookingPresenter);
    });
  });
});
