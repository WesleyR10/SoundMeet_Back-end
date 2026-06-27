import { ConversationInMemoryRepository } from "../../../../infra/db/in-memory/conversation-in-memory.repository";
import { MessageInMemoryRepository } from "../../../../infra/db/in-memory/message-in-memory.repository";
import { Conversation } from "../../../../domain/conversation.aggregate";
import { Message } from "../../../../domain/message.aggregate";
import { GetConversationUseCase } from "../get-conversation.use-case";

describe("GetConversationUseCase", () => {
  let convRepo: ConversationInMemoryRepository;
  let msgRepo: MessageInMemoryRepository;
  let useCase: GetConversationUseCase;
  let testConv: Conversation;

  beforeEach(async () => {
    convRepo = new ConversationInMemoryRepository();
    msgRepo = new MessageInMemoryRepository();
    useCase = new GetConversationUseCase(convRepo, msgRepo);

    testConv = Conversation.fake().aConversation().build();
    await convRepo.insert(testConv);
  });

  it("should return conversation and empty messages list", async () => {
    const out = await useCase.execute({
      conversation_id: testConv.conversation_id.id,
      requester_id: testConv.establishment_id,
    });

    expect(out.conversation.conversation_id).toBe(testConv.conversation_id.id);
    expect(out.messages).toHaveLength(0);
    expect(out.next_cursor).toBeNull();
  });

  it("should return messages belonging to the conversation", async () => {
    const msg1 = Message.fake()
      .aMessage()
      .withConversationId(testConv.conversation_id.id)
      .withSenderId(testConv.musician_id!)
      .withContent("Oi!")
      .build();
    const msg2 = Message.fake()
      .aMessage()
      .withConversationId(testConv.conversation_id.id)
      .withSenderId(testConv.establishment_id)
      .withContent("Olá!")
      .build();

    await msgRepo.insert(msg1);
    await msgRepo.insert(msg2);

    const out = await useCase.execute({
      conversation_id: testConv.conversation_id.id,
      requester_id: testConv.musician_id!,
    });

    expect(out.messages).toHaveLength(2);
    expect(out.messages[0].content).toBe("Oi!");
    expect(out.messages[1].content).toBe("Olá!");
  });

  it("should throw NotFoundError for non-existing conversation", async () => {
    await expect(
      useCase.execute({
        conversation_id: "00000000-0000-0000-0000-000000000000",
        requester_id: testConv.establishment_id,
      }),
    ).rejects.toThrow();
  });

  it("should throw when requester is not a participant", async () => {
    await expect(
      useCase.execute({
        conversation_id: testConv.conversation_id.id,
        requester_id: "00000000-0000-0000-0000-000000000099",
      }),
    ).rejects.toThrow();
  });

  it("should respect limit and return next_cursor when there are more messages", async () => {
    for (let i = 0; i < 5; i++) {
      const msg = Message.fake()
        .aMessage()
        .withConversationId(testConv.conversation_id.id)
        .withSenderId(testConv.musician_id!)
        .withContent(`Mensagem ${i + 1}`)
        .build();
      await msgRepo.insert(msg);
    }

    const out = await useCase.execute({
      conversation_id: testConv.conversation_id.id,
      requester_id: testConv.musician_id!,
      limit: 3,
    });

    expect(out.messages).toHaveLength(3);
    expect(out.next_cursor).not.toBeNull();
  });
});
