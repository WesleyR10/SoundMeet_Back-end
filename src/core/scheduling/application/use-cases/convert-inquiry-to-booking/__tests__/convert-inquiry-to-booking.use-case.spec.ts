import { Inquiry } from "../../../../domain/inquiry.aggregate";
import { BookingInMemoryRepository } from "../../../../infra/db/in-memory/booking-in-memory.repository";
import { InquiryInMemoryRepository } from "../../../../infra/db/in-memory/inquiry-in-memory.repository";
import { ConvertInquiryToBookingUseCase } from "../convert-inquiry-to-booking.use-case";

describe("ConvertInquiryToBookingUseCase Unit Tests", () => {
  it("should throw when booking is invalid and not persist", async () => {
    const inquiryRepo = new InquiryInMemoryRepository();
    const bookingRepo = new BookingInMemoryRepository();
    const now = new Date("2024-01-01T09:00:00.000Z");

    const inquiry = Inquiry.fake().anInquiry().accepted().build();
    await inquiryRepo.insert(inquiry);

    const useCase = new ConvertInquiryToBookingUseCase(
      inquiryRepo,
      bookingRepo,
      { now: () => now },
    );

    await expect(async () => {
      await useCase.execute({
        inquiry_id: inquiry.inquiry_id.id,
        start_at: new Date("2024-01-10T12:00:00.000Z"),
        end_at: new Date("2024-01-10T11:00:00.000Z"),
        fee: 800,
      });
    }).rejects.toMatchObject({
      name: "EntityValidationError",
      error: expect.arrayContaining([
        {
          end_at: ["end_at must be greater than start_at"],
        },
      ]),
    });

    const bookings = await bookingRepo.findAll();
    expect(bookings).toHaveLength(0);
  });

  describe("quais inquiries podem virar proposta (18/set/2026)", () => {
    const now = new Date();
    const inDays = (days: number, hour: number) => {
      const date = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      date.setUTCHours(hour, 0, 0, 0);
      return date;
    };

    const setup = async (inquiry: Inquiry) => {
      const inquiryRepo = new InquiryInMemoryRepository();
      const bookingRepo = new BookingInMemoryRepository();
      await inquiryRepo.insert(inquiry);
      const useCase = new ConvertInquiryToBookingUseCase(
        inquiryRepo,
        bookingRepo,
        { now: () => now },
      );
      return { useCase, bookingRepo, inquiryRepo };
    };

    it("🔴 converts an OPEN inquiry — the artist answers on the booking, which is born pending", async () => {
      const inquiry = Inquiry.fake().anInquiry().open().build();
      const { useCase, inquiryRepo } = await setup(inquiry);

      const output = await useCase.execute({
        inquiry_id: inquiry.inquiry_id.id,
        start_at: inDays(4, 22),
        end_at: inDays(5, 1),
        fee: 700,
        proposed_by: "establishment",
      });

      expect(output.status).toBe("pending");
      // Quem converteu é quem propôs — é o que diz ao app que a vez é do artista.
      expect(output.proposed_by).toBe("establishment");

      const stored = await inquiryRepo.findById(inquiry.inquiry_id);
      expect(stored?.status.value).toBe("converted");
      expect(stored?.booking_id?.id).toBe(output.id);
    });

    it("still refuses a REJECTED inquiry — the artist already said no", async () => {
      const inquiry = Inquiry.fake().anInquiry().rejected().build();
      const { useCase, bookingRepo } = await setup(inquiry);

      await expect(
        useCase.execute({
          inquiry_id: inquiry.inquiry_id.id,
          start_at: inDays(4, 22),
          end_at: inDays(5, 1),
          fee: 800,
        }),
      ).rejects.toMatchObject({ name: "EntityValidationError" });

      expect(await bookingRepo.findAll()).toHaveLength(0);
    });
  });
});
