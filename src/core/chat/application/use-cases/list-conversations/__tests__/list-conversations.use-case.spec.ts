import { v4 as uuidv4 } from "uuid";
import { ConversationInMemoryRepository } from "../../../../infra/db/in-memory/conversation-in-memory.repository";
import { MessageInMemoryRepository } from "../../../../infra/db/in-memory/message-in-memory.repository";
import { Conversation } from "../../../../domain/conversation.aggregate";
import { Message } from "../../../../domain/message.aggregate";
import { ListConversationsUseCase } from "../list-conversations.use-case";

describe("ListConversationsUseCase", () => {
  let convRepo: ConversationInMemoryRepository;
  let msgRepo: MessageInMemoryRepository;
  let useCase: ListConversationsUseCase;

  const musicianId = uuidv4();
  const otherMusicianId = uuidv4();

  beforeEach(() => {
    convRepo = new ConversationInMemoryRepository();
    msgRepo = new MessageInMemoryRepository();
    useCase = new ListConversationsUseCase(convRepo, msgRepo);
  });

  it("should return empty list when participant has no conversations", async () => {
    const out = await useCase.execute({ participant_id: musicianId });

    expect(out.conversations).toHaveLength(0);
  });

  it("should return conversations where participant is musician", async () => {
    const conv = Conversation.fake()
      .aConversation()
      .withMusicianId(musicianId)
      .build();
    await convRepo.insert(conv);

    const out = await useCase.execute({ participant_id: musicianId });

    expect(out.conversations).toHaveLength(1);
    expect(out.conversations[0].musician_id).toBe(musicianId);
  });

  it("should return conversations where participant is band", async () => {
    const bandId = uuidv4();
    const conv = Conversation.fake()
      .aConversation()
      .withMusicianId(null)
      .withBandId(bandId)
      .build();
    await convRepo.insert(conv);

    const out = await useCase.execute({ participant_id: bandId });

    expect(out.conversations).toHaveLength(1);
    expect(out.conversations[0].band_id).toBe(bandId);
  });

  it("should not return conversations for other participants", async () => {
    const conv = Conversation.fake()
      .aConversation()
      .withMusicianId(otherMusicianId)
      .build();
    await convRepo.insert(conv);

    const out = await useCase.execute({ participant_id: musicianId });

    expect(out.conversations).toHaveLength(0);
  });

  it("should return multiple conversations for the same participant", async () => {
    const conv1 = Conversation.fake()
      .aConversation()
      .withMusicianId(musicianId)
      .build();
    const conv2 = Conversation.fake()
      .aConversation()
      .withMusicianId(musicianId)
      .build();
    await convRepo.insert(conv1);
    await convRepo.insert(conv2);

    const out = await useCase.execute({ participant_id: musicianId });

    expect(out.conversations).toHaveLength(2);
  });

  it("should return JSON representation of conversations", async () => {
    const conv = Conversation.fake()
      .aConversation()
      .withMusicianId(musicianId)
      .build();
    await convRepo.insert(conv);

    const out = await useCase.execute({ participant_id: musicianId });

    expect(out.conversations[0]).toMatchObject({
      conversation_id: conv.conversation_id.id,
      musician_id: musicianId,
    });
  });

  it("should return last_message as null when the conversation has no messages", async () => {
    const conv = Conversation.fake()
      .aConversation()
      .withMusicianId(musicianId)
      .build();
    await convRepo.insert(conv);

    const out = await useCase.execute({ participant_id: musicianId });

    expect(out.conversations[0].last_message).toBeNull();
    expect(out.conversations[0].unread_count).toBe(0);
  });

  it("should return the most recent message as last_message", async () => {
    const conv = Conversation.fake()
      .aConversation()
      .withMusicianId(musicianId)
      .build();
    await convRepo.insert(conv);

    const older = Message.fake()
      .aMessage()
      .withConversationId(conv.conversation_id.id)
      .withSenderId(conv.establishment_id)
      .withContent("Primeira")
      .build();
    older.created_at = new Date("2026-01-01T10:00:00Z");
    const newer = Message.fake()
      .aMessage()
      .withConversationId(conv.conversation_id.id)
      .withSenderId(conv.establishment_id)
      .withContent("Segunda")
      .build();
    newer.created_at = new Date("2026-01-01T11:00:00Z");
    await msgRepo.insert(older);
    await msgRepo.insert(newer);

    const out = await useCase.execute({ participant_id: musicianId });

    expect(out.conversations[0].last_message?.content).toBe("Segunda");
  });

  it("should count unread messages sent by the other participant", async () => {
    const conv = Conversation.fake()
      .aConversation()
      .withMusicianId(musicianId)
      .build();
    await convRepo.insert(conv);

    const fromEstablishment = Message.fake()
      .aMessage()
      .withConversationId(conv.conversation_id.id)
      .withSenderId(conv.establishment_id)
      .build();
    const ownMessage = Message.fake()
      .aMessage()
      .withConversationId(conv.conversation_id.id)
      .withSenderId(musicianId)
      .build();
    await msgRepo.insert(fromEstablishment);
    await msgRepo.insert(ownMessage);

    const out = await useCase.execute({ participant_id: musicianId });

    // Só a mensagem do estabelecimento conta como não lida — a própria
    // mensagem do músico nunca entra na contagem dele mesmo.
    expect(out.conversations[0].unread_count).toBe(1);
  });
});
