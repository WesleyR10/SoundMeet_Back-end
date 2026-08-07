import { ForbiddenException } from "@nestjs/common";

import { AssertConversationParticipantUseCase } from "../../../core/chat/application/use-cases";
import { Conversation } from "../../../core/chat/domain/conversation.aggregate";
import { ConversationInMemoryRepository } from "../../../core/chat/infra/db/in-memory/conversation-in-memory.repository";
import { ChatGateway } from "../chat.gateway";

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const OUTSIDER_ID = "33333333-3333-4333-8333-333333333333";
const BAND_ID = "44444444-4444-4444-8444-444444444444";

function makeSocket(currentUser: unknown) {
  return {
    id: "socket-1",
    data: { currentUser },
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

const user = (over: Record<string, unknown> = {}) => ({
  userId: MUSICIAN_ID,
  roles: ["musician"],
  establishmentIds: [] as string[],
  bandIds: [] as string[],
  isAdmin: false,
  ...over,
});

describe("ChatGateway — autorização de join_conversation", () => {
  let convRepo: ConversationInMemoryRepository;
  let gateway: ChatGateway;
  let conversation: Conversation;

  beforeEach(async () => {
    convRepo = new ConversationInMemoryRepository();
    conversation = Conversation.create({
      inquiry_id: "55555555-5555-4555-8555-555555555555",
      establishment_id: ESTABLISHMENT_ID,
      musician_id: MUSICIAN_ID,
      band_id: null,
    });
    await convRepo.insert(conversation);

    gateway = new ChatGateway(
      {} as never,
      new AssertConversationParticipantUseCase(convRepo),
    );
  });

  const join = async (currentUser: unknown, conversationId: string) => {
    const client = makeSocket(currentUser);
    await gateway.handleJoinConversation(client as never, {
      conversation_id: conversationId,
    });
    return client;
  };

  it("permite o músico participante entrar na room", async () => {
    const client = await join(user(), conversation.conversation_id.id);

    expect(client.join).toHaveBeenCalledWith(
      `conversation:${conversation.conversation_id.id}`,
    );
    expect(client.emit).toHaveBeenCalledWith("joined_conversation", {
      conversation_id: conversation.conversation_id.id,
    });
  });

  it("permite o estabelecimento participante (identidade vem de establishment_ids)", async () => {
    const client = await join(
      user({
        userId: "99999999-9999-4999-8999-999999999999",
        roles: ["establishment"],
        establishmentIds: [ESTABLISHMENT_ID],
      }),
      conversation.conversation_id.id,
    );

    expect(client.join).toHaveBeenCalled();
  });

  it("recusa não participante sem ingressar na room", async () => {
    const client = await join(
      user({ userId: OUTSIDER_ID }),
      conversation.conversation_id.id,
    );

    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith("join_conversation_error", {
      conversation_id: conversation.conversation_id.id,
      reason: "forbidden",
    });
  });

  it("ignora conversation_id do payload que não bate com os claims da banda", async () => {
    const bandConversation = Conversation.create({
      inquiry_id: "66666666-6666-4666-8666-666666666666",
      establishment_id: ESTABLISHMENT_ID,
      musician_id: null,
      band_id: BAND_ID,
    });
    await convRepo.insert(bandConversation);

    const semBanda = await join(
      user({ userId: OUTSIDER_ID, roles: ["band"], bandIds: [] }),
      bandConversation.conversation_id.id,
    );
    expect(semBanda.join).not.toHaveBeenCalled();

    const comBanda = await join(
      user({ userId: OUTSIDER_ID, roles: ["band"], bandIds: [BAND_ID] }),
      bandConversation.conversation_id.id,
    );
    expect(comBanda.join).toHaveBeenCalled();
  });

  it("admin entra em qualquer conversa (política explícita)", async () => {
    const client = await join(
      user({ userId: OUTSIDER_ID, roles: ["admin"], isAdmin: true }),
      conversation.conversation_id.id,
    );

    expect(client.join).toHaveBeenCalled();
  });

  it("rejeita UUID malformado antes de tocar no repositório", async () => {
    const spy = jest.spyOn(convRepo, "findById");
    const client = await join(user(), "not-a-uuid");

    expect(spy).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith("join_conversation_error", {
      conversation_id: "not-a-uuid",
      reason: "invalid_conversation_id",
    });
  });

  it("não diferencia conversa inexistente de proibida (anti-enumeração)", async () => {
    const inexistente = await join(
      user(),
      "77777777-7777-4777-8777-777777777777",
    );
    const proibida = await join(
      user({ userId: OUTSIDER_ID }),
      conversation.conversation_id.id,
    );

    const [, inexistentePayload] = inexistente.emit.mock.calls[0];
    const [, proibidaPayload] = proibida.emit.mock.calls[0];
    expect(inexistentePayload.reason).toBe(proibidaPayload.reason);
    expect(inexistentePayload.reason).toBe("forbidden");
  });

  it("desconecta socket sem contexto autenticado", async () => {
    const client = makeSocket(undefined);
    await gateway.handleJoinConversation(client as never, {
      conversation_id: conversation.conversation_id.id,
    });

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it("reconexão reavalia a política — join não fica memorizado no socket", async () => {
    const primeira = await join(user(), conversation.conversation_id.id);
    expect(primeira.join).toHaveBeenCalled();

    // Novo socket, mesmo usuário, agora sem ser participante.
    const segunda = await join(
      user({ userId: OUTSIDER_ID }),
      conversation.conversation_id.id,
    );
    expect(segunda.join).not.toHaveBeenCalled();
  });
});

describe("AssertConversationParticipantUseCase", () => {
  it("lança ForbiddenException para quem não participa", async () => {
    const convRepo = new ConversationInMemoryRepository();
    const conversation = Conversation.create({
      inquiry_id: "55555555-5555-4555-8555-555555555555",
      establishment_id: ESTABLISHMENT_ID,
      musician_id: MUSICIAN_ID,
      band_id: null,
    });
    await convRepo.insert(conversation);

    const useCase = new AssertConversationParticipantUseCase(convRepo);

    await expect(
      useCase.execute({
        conversation_id: conversation.conversation_id.id,
        participant_ids: [OUTSIDER_ID],
      }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      useCase.execute({
        conversation_id: conversation.conversation_id.id,
        participant_ids: [OUTSIDER_ID, MUSICIAN_ID],
      }),
    ).resolves.toMatchObject({
      conversation: { conversation_id: conversation.conversation_id.id },
    });
  });
});
