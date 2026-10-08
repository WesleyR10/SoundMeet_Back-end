import { BookingId } from "../../../core/scheduling/domain/booking.aggregate";
import { BookingProposedEvent } from "../../../core/scheduling/domain/events/booking-proposed.event";
import { InquiryCreatedEvent } from "../../../core/scheduling/domain/events/inquiry-created.event";
import { InquiryId } from "../../../core/scheduling/domain/inquiry.aggregate";
import { BookingStatus } from "../../../core/shared/domain/value-objects/booking-status.vo";
import { ChatEventsHandler } from "../chat-events.handler";

const makeEvent = (
  overrides: Partial<{
    musician_id: string | null;
    band_id: string | null;
  }> = {},
) =>
  new InquiryCreatedEvent({
    inquiry_id: new InquiryId(),
    establishment_id: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
    musician_id: "f47ac10b-58cc-4372-a567-0e02b2c3d481",
    band_id: null,
    event_id: null,
    subject: "Noite de samba",
    expires_at: null,
    created_at: new Date(),
    ...overrides,
  });

describe("ChatEventsHandler", () => {
  let mockUseCase: { execute: jest.Mock };
  let handler: ChatEventsHandler;

  beforeEach(() => {
    mockUseCase = {
      execute: jest.fn().mockResolvedValue({
        conversation_id: "conv-1",
        already_existed: false,
      }),
    };
    handler = new ChatEventsHandler(mockUseCase as any);
  });

  it("should call OpenConversationUseCase with correct fields from InquiryCreatedEvent", async () => {
    const event = makeEvent();
    await handler.handleInquiryCreated(event);

    expect(mockUseCase.execute).toHaveBeenCalledTimes(1);
    expect(mockUseCase.execute).toHaveBeenCalledWith({
      inquiry_id: event.aggregate_id.id,
      establishment_id: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
      musician_id: "f47ac10b-58cc-4372-a567-0e02b2c3d481",
      band_id: null,
    });
  });

  it("should pass band_id correctly when conversation is for a band", async () => {
    const event = makeEvent({
      musician_id: null,
      band_id: "f47ac10b-58cc-4372-a567-0e02b2c3d482",
    });
    await handler.handleInquiryCreated(event);

    expect(mockUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        musician_id: null,
        band_id: "f47ac10b-58cc-4372-a567-0e02b2c3d482",
      }),
    );
  });

  it("should NOT throw when use-case rejects — it logs the error instead", async () => {
    mockUseCase.execute.mockRejectedValue(new Error("DB down"));
    const event = makeEvent();

    await expect(handler.handleInquiryCreated(event)).resolves.toBeUndefined();
  });

  it("should handle already_existed: true without error", async () => {
    mockUseCase.execute.mockResolvedValue({
      conversation_id: "conv-1",
      already_existed: true,
    });
    const event = makeEvent();
    await expect(handler.handleInquiryCreated(event)).resolves.toBeUndefined();
  });
});

/**
 * A segunda porta: propor um show também abre canal.
 *
 * E a guarda que evita o fio partido — `ConvertInquiryToBookingUseCase` chama
 * `Booking.create`, logo emite o MESMO `BookingProposedEvent`, e a inquiry de
 * origem já tem conversa aberta desde o `InquiryCreatedEvent`.
 */
describe("ChatEventsHandler — BookingProposedEvent", () => {
  const ESTABELECIMENTO = "f47ac10b-58cc-4372-a567-0e02b2c3d480";
  const MUSICO = "f47ac10b-58cc-4372-a567-0e02b2c3d481";

  const makeBookingEvent = (
    overrides: Partial<{
      from_inquiry_id: string | null;
      musician_id: string | null;
      band_id: string | null;
    }> = {},
  ) =>
    new BookingProposedEvent({
      booking_id: new BookingId(),
      from_inquiry_id: null,
      establishment_id: ESTABELECIMENTO,
      musician_id: MUSICO,
      band_id: null,
      event_id: null,
      start_at: new Date("2026-10-17T22:00:00.000Z"),
      end_at: new Date("2026-10-18T02:00:00.000Z"),
      fee: 800,
      status: BookingStatus.pending(),
      buffer_minutes: 0,
      expires_at: null,
      created_at: new Date(),
      ...overrides,
    });

  let mockUseCase: { execute: jest.Mock };
  let handler: ChatEventsHandler;

  beforeEach(() => {
    mockUseCase = {
      execute: jest.fn().mockResolvedValue({
        conversation_id: "conv-1",
        already_existed: false,
      }),
    };
    handler = new ChatEventsHandler(mockUseCase as any);
  });

  it("abre a conversa da PROPOSTA com booking_id, nunca inquiry_id", async () => {
    const event = makeBookingEvent();

    await handler.handleBookingProposed(event);

    expect(mockUseCase.execute).toHaveBeenCalledTimes(1);
    expect(mockUseCase.execute).toHaveBeenCalledWith({
      booking_id: event.aggregate_id.id,
      establishment_id: ESTABELECIMENTO,
      musician_id: MUSICO,
      band_id: null,
    });
  });

  it("repassa a banda quando a proposta é para uma banda", async () => {
    await handler.handleBookingProposed(
      makeBookingEvent({
        musician_id: null,
        band_id: "f47ac10b-58cc-4372-a567-0e02b2c3d482",
      }),
    );

    expect(mockUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        musician_id: null,
        band_id: "f47ac10b-58cc-4372-a567-0e02b2c3d482",
      }),
    );
  });

  it("🔴 NÃO abre segunda conversa quando o booking veio de uma CONVERSÃO", async () => {
    /*
     * Este é o caso que parte a negociação em dois fios sem nada acusar: o
     * histórico fica na conversa da inquiry, a proposta convertida numa
     * conversa nova, e nenhuma das duas aponta para a outra.
     */
    await handler.handleBookingProposed(
      makeBookingEvent({
        from_inquiry_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      }),
    );

    expect(mockUseCase.execute).not.toHaveBeenCalled();
  });

  it("não derruba o fluxo quando o use case falha — a proposta já foi gravada", async () => {
    mockUseCase.execute.mockRejectedValue(new Error("DB down"));

    await expect(
      handler.handleBookingProposed(makeBookingEvent()),
    ).resolves.toBeUndefined();
  });
});
