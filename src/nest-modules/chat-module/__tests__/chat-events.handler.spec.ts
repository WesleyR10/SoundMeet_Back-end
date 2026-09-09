import { InquiryCreatedEvent } from "../../../core/scheduling/domain/events/inquiry-created.event";
import { InquiryId } from "../../../core/scheduling/domain/inquiry.aggregate";
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
