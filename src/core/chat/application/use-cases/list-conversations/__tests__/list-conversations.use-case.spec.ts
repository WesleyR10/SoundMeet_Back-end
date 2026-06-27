import { v4 as uuidv4 } from "uuid";
import { ConversationInMemoryRepository } from "../../../../infra/db/in-memory/conversation-in-memory.repository";
import { Conversation } from "../../../../domain/conversation.aggregate";
import { ListConversationsUseCase } from "../list-conversations.use-case";

describe("ListConversationsUseCase", () => {
  let convRepo: ConversationInMemoryRepository;
  let useCase: ListConversationsUseCase;

  const musicianId = uuidv4();
  const otherMusicianId = uuidv4();

  beforeEach(() => {
    convRepo = new ConversationInMemoryRepository();
    useCase = new ListConversationsUseCase(convRepo);
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
});
