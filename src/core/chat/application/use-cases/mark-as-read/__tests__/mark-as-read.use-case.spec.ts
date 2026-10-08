import { Conversation } from "../../../../domain/conversation.aggregate";
import { Message } from "../../../../domain/message.aggregate";
import { ConversationInMemoryRepository } from "../../../../infra/db/in-memory/conversation-in-memory.repository";
import { MessageInMemoryRepository } from "../../../../infra/db/in-memory/message-in-memory.repository";
import { MarkAsReadUseCase } from "../mark-as-read.use-case";

describe("MarkAsReadUseCase", () => {
  let convRepo: ConversationInMemoryRepository;
  let msgRepo: MessageInMemoryRepository;
  let useCase: MarkAsReadUseCase;
  let testConv: Conversation;

  beforeEach(async () => {
    convRepo = new ConversationInMemoryRepository();
    msgRepo = new MessageInMemoryRepository();
    useCase = new MarkAsReadUseCase(convRepo, msgRepo);

    testConv = Conversation.fake().aConversation().build();
    await convRepo.insert(testConv);
  });

  it("should mark messages sent by other participants as read", async () => {
    // Musician sends a message — establishment will read it
    const msg = Message.fake()
      .aMessage()
      .withConversationId(testConv.conversation_id.id)
      .withSenderId(testConv.musician_id!)
      .build();
    await msgRepo.insert(msg);

    expect(msgRepo.items[0].status).toBe("sent");

    await useCase.execute({
      conversation_id: testConv.conversation_id.id,
      reader_ids: [testConv.establishment_id],
    });

    expect(msgRepo.items[0].status).toBe("read");
    expect(msgRepo.items[0].read_at).not.toBeNull();
  });

  it("should not mark own messages as read", async () => {
    // Establishment sends a message and tries to read its own
    const msg = Message.fake()
      .aMessage()
      .withConversationId(testConv.conversation_id.id)
      .withSenderId(testConv.establishment_id)
      .build();
    await msgRepo.insert(msg);

    await useCase.execute({
      conversation_id: testConv.conversation_id.id,
      reader_ids: [testConv.establishment_id],
    });

    // Should remain "sent" — own messages are not marked read
    expect(msgRepo.items[0].status).toBe("sent");
  });

  it("should mark all unread messages in the conversation as read", async () => {
    for (let i = 0; i < 3; i++) {
      const msg = Message.fake()
        .aMessage()
        .withConversationId(testConv.conversation_id.id)
        .withSenderId(testConv.musician_id!)
        .withContent(`Mensagem ${i + 1}`)
        .build();
      await msgRepo.insert(msg);
    }

    await useCase.execute({
      conversation_id: testConv.conversation_id.id,
      reader_ids: [testConv.establishment_id],
    });

    for (const msg of msgRepo.items) {
      expect(msg.status).toBe("read");
    }
  });

  it("should throw NotFoundError for non-existing conversation", async () => {
    await expect(
      useCase.execute({
        conversation_id: "00000000-0000-0000-0000-000000000000",
        reader_ids: [testConv.establishment_id],
      }),
    ).rejects.toThrow();
  });

  it("should succeed without errors when there are no messages to read", async () => {
    await expect(
      useCase.execute({
        conversation_id: testConv.conversation_id.id,
        reader_ids: [testConv.establishment_id],
      }),
    ).resolves.toEqual({ reader_id: testConv.establishment_id });
  });

  it("should resolve the concrete reader_id from multiple candidate identities", async () => {
    // Dono com mais de um estabelecimento: só a unidade que participa desta
    // conversa deve ser usada como reader_id, não a 1ª candidata.
    const msg = Message.fake()
      .aMessage()
      .withConversationId(testConv.conversation_id.id)
      .withSenderId(testConv.musician_id!)
      .build();
    await msgRepo.insert(msg);

    const otherUnitId = "00000000-0000-0000-0000-000000000077";
    const output = await useCase.execute({
      conversation_id: testConv.conversation_id.id,
      reader_ids: [otherUnitId, testConv.establishment_id],
    });

    expect(output.reader_id).toBe(testConv.establishment_id);
    expect(msgRepo.items[0].status).toBe("read");
  });
});
