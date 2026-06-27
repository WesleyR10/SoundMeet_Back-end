import { ConversationInMemoryRepository } from "../../../../infra/db/in-memory/conversation-in-memory.repository";
import { MessageInMemoryRepository } from "../../../../infra/db/in-memory/message-in-memory.repository";
import { Conversation } from "../../../../domain/conversation.aggregate";
import { SendMessageUseCase } from "../send-message.use-case";

describe("SendMessageUseCase", () => {
  let convRepo: ConversationInMemoryRepository;
  let msgRepo: MessageInMemoryRepository;
  let useCase: SendMessageUseCase;
  let testConv: Conversation;

  beforeEach(async () => {
    convRepo = new ConversationInMemoryRepository();
    msgRepo = new MessageInMemoryRepository();
    useCase = new SendMessageUseCase(convRepo, msgRepo);

    testConv = Conversation.fake().aConversation().build();
    await convRepo.insert(testConv);
  });

  it("should send a message and return it", async () => {
    const out = await useCase.execute({
      conversation_id: testConv.conversation_id.id,
      sender_id: testConv.musician_id!,
      sender_type: "musician",
      content: "Topamos!",
    });

    expect(out.message_id).toBeDefined();
    expect(out.status).toBe("sent");
    expect(out.content).toBe("Topamos!");
    expect(out.sender_id).toBe(testConv.musician_id);
    expect(out.conversation_id).toBe(testConv.conversation_id.id);
    expect(msgRepo.items).toHaveLength(1);
  });

  it("should allow establishment to send a message", async () => {
    const out = await useCase.execute({
      conversation_id: testConv.conversation_id.id,
      sender_id: testConv.establishment_id,
      sender_type: "establishment",
      content: "Olá, músico!",
    });

    expect(out.message_id).toBeDefined();
    expect(out.sender_id).toBe(testConv.establishment_id);
    expect(msgRepo.items).toHaveLength(1);
  });

  it("should throw when sender is not a participant", async () => {
    await expect(
      useCase.execute({
        conversation_id: testConv.conversation_id.id,
        sender_id: "00000000-0000-0000-0000-000000000099",
        sender_type: "musician",
        content: "intruso",
      }),
    ).rejects.toThrow();
  });

  it("should throw for non-existing conversation", async () => {
    await expect(
      useCase.execute({
        conversation_id: "00000000-0000-0000-0000-000000000000",
        sender_id: "any-id",
        sender_type: "musician",
        content: "hello",
      }),
    ).rejects.toThrow();
  });

  it("should persist multiple messages in the same conversation", async () => {
    await useCase.execute({
      conversation_id: testConv.conversation_id.id,
      sender_id: testConv.musician_id!,
      sender_type: "musician",
      content: "Primeira mensagem",
    });

    await useCase.execute({
      conversation_id: testConv.conversation_id.id,
      sender_id: testConv.establishment_id,
      sender_type: "establishment",
      content: "Segunda mensagem",
    });

    expect(msgRepo.items).toHaveLength(2);
  });
});
