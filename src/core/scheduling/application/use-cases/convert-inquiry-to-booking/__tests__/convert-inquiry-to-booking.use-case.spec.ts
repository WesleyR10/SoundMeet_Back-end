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
});
