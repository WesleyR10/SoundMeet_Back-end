import { v4 as uuidv4 } from "uuid";
import { ConversationInMemoryRepository } from "../../../../infra/db/in-memory/conversation-in-memory.repository";
import { OpenConversationUseCase } from "../open-conversation.use-case";

describe("OpenConversationUseCase", () => {
  let convRepo: ConversationInMemoryRepository;
  let useCase: OpenConversationUseCase;

  const inquiryId = uuidv4();
  const establishmentId = uuidv4();
  const musicianId = uuidv4();

  beforeEach(() => {
    convRepo = new ConversationInMemoryRepository();
    useCase = new OpenConversationUseCase(convRepo);
  });

  it("should create a new conversation when none exists for the inquiry", async () => {
    const out = await useCase.execute({
      inquiry_id: inquiryId,
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    expect(out.conversation_id).toBeDefined();
    expect(out.already_existed).toBe(false);
    expect(convRepo.items).toHaveLength(1);
  });

  it("should return already_existed false for a brand new conversation", async () => {
    const out = await useCase.execute({
      inquiry_id: uuidv4(),
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    expect(out.already_existed).toBe(false);
  });

  it("should return the existing conversation when called again with the same inquiry_id", async () => {
    const first = await useCase.execute({
      inquiry_id: inquiryId,
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    const second = await useCase.execute({
      inquiry_id: inquiryId,
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    expect(second.conversation_id).toBe(first.conversation_id);
    expect(second.already_existed).toBe(true);
    expect(convRepo.items).toHaveLength(1);
  });

  it("should return already_existed true for existing conversation", async () => {
    await useCase.execute({
      inquiry_id: inquiryId,
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    const out = await useCase.execute({
      inquiry_id: inquiryId,
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    expect(out.already_existed).toBe(true);
  });

  it("should create independent conversations for different inquiry_ids", async () => {
    await useCase.execute({
      inquiry_id: uuidv4(),
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    await useCase.execute({
      inquiry_id: uuidv4(),
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    expect(convRepo.items).toHaveLength(2);
  });
});
