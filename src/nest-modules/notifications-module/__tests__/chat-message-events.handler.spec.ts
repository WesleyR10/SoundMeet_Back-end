import { Conversation } from "../../../core/chat/domain/conversation.aggregate";
import { IConversationRepository } from "../../../core/chat/domain/conversation.repository";
import { MessageSentEvent } from "../../../core/chat/domain/events/message-sent.event";
import { MessageId } from "../../../core/chat/domain/message.aggregate";
import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../core/musician/domain/musician.repository";
import { NotificationsChatEventsHandler } from "../chat-message-events.handler";
import { NotificationsGateway } from "../notifications.gateway";
import { PushNotificationService } from "../push-notification.service";

const makeGatewayMock = (): jest.Mocked<
  Pick<NotificationsGateway, "notifyChatMessage">
> => ({
  notifyChatMessage: jest.fn(),
});

const makeConvRepoMock = (): jest.Mocked<
  Pick<IConversationRepository, "findById">
> => ({
  findById: jest.fn(),
});

const makeMusicianRepoMock = (): jest.Mocked<
  Pick<IMusicianRepository, "findById">
> => ({
  findById: jest.fn(),
});

const makePushServiceMock = (): jest.Mocked<
  Pick<PushNotificationService, "send">
> => ({
  send: jest.fn(),
});

describe("NotificationsChatEventsHandler", () => {
  let handler: NotificationsChatEventsHandler;
  let gateway: jest.Mocked<Pick<NotificationsGateway, "notifyChatMessage">>;
  let convRepo: jest.Mocked<Pick<IConversationRepository, "findById">>;
  let musicianRepo: jest.Mocked<Pick<IMusicianRepository, "findById">>;
  let pushNotificationService: jest.Mocked<
    Pick<PushNotificationService, "send">
  >;

  const musicianId = "8c0e9a2e-1b7a-4f3e-9c2a-2a6b1e4d5f01";
  const establishmentId = "22222222-2222-4222-8222-222222222222";

  function makeEvent(senderId: string) {
    return new MessageSentEvent({
      message_id: new MessageId(),
      conversation_id: "33333333-3333-4333-8333-333333333333",
      sender_id: senderId,
    });
  }

  // MusicianFakeBuilder não tem withPushToken() — seta a propriedade pública
  // direto após o build, mesmo padrão já usado nesta codebase pra campos sem
  // builder dedicado (ver created_at em list-conversations.use-case.spec.ts).
  function musicianWithPushToken(token: string | null) {
    const musician = Musician.fake().aMusician().build();
    musician.push_token = token;
    return musician;
  }

  beforeEach(() => {
    gateway = makeGatewayMock();
    convRepo = makeConvRepoMock();
    musicianRepo = makeMusicianRepoMock();
    pushNotificationService = makePushServiceMock();
    handler = new NotificationsChatEventsHandler(
      gateway as unknown as NotificationsGateway,
      convRepo as unknown as IConversationRepository,
      musicianRepo as unknown as IMusicianRepository,
      pushNotificationService as unknown as PushNotificationService,
    );
  });

  it("should notify the gateway and send a push when the establishment sends a message to the musician", async () => {
    const conversation = Conversation.fake()
      .aConversation()
      .withEstablishmentId(establishmentId)
      .withMusicianId(musicianId)
      .build();
    convRepo.findById.mockResolvedValue(conversation);
    musicianRepo.findById.mockResolvedValue(
      musicianWithPushToken("ExponentPushToken[abc]"),
    );

    await handler.handleMessageSent(makeEvent(establishmentId));

    expect(gateway.notifyChatMessage).toHaveBeenCalledTimes(1);
    expect(gateway.notifyChatMessage).toHaveBeenCalledWith(
      musicianId,
      expect.objectContaining({ sender_id: establishmentId }),
    );
    expect(pushNotificationService.send).toHaveBeenCalledWith(
      "ExponentPushToken[abc]",
      expect.objectContaining({
        title: "Nova mensagem 💬",
        body: "Você recebeu uma nova mensagem",
        data: { type: "chat.message.new", conversation_id: expect.any(String) },
      }),
    );
  });

  it("should never include message content in the push payload (no IMessageRepository dependency)", async () => {
    // Regressão: o handler não injeta mais IMessageRepository (dead fetch
    // removido — o resultado nunca era usado, ver revisão pós-implementação).
    // A notificação é estaticamente genérica; este teste garante que uma
    // reintrodução futura de preview de conteúdo não passa despercebida.
    const conversation = Conversation.fake()
      .aConversation()
      .withEstablishmentId(establishmentId)
      .withMusicianId(musicianId)
      .build();
    convRepo.findById.mockResolvedValue(conversation);
    musicianRepo.findById.mockResolvedValue(
      musicianWithPushToken("ExponentPushToken[abc]"),
    );

    await handler.handleMessageSent(makeEvent(establishmentId));

    const [, pushMessage] = pushNotificationService.send.mock.calls[0];
    expect(pushMessage.body).toBe("Você recebeu uma nova mensagem");
    expect(pushMessage.data).toEqual({
      type: "chat.message.new",
      conversation_id: expect.any(String),
    });
  });

  it("should not notify when the sender is the musician themself (self-echo)", async () => {
    const conversation = Conversation.fake()
      .aConversation()
      .withEstablishmentId(establishmentId)
      .withMusicianId(musicianId)
      .build();
    convRepo.findById.mockResolvedValue(conversation);

    await handler.handleMessageSent(makeEvent(musicianId));

    expect(gateway.notifyChatMessage).not.toHaveBeenCalled();
    expect(pushNotificationService.send).not.toHaveBeenCalled();
  });

  it("should not notify when the conversation has no musician participant (band-only)", async () => {
    const conversation = Conversation.fake()
      .aConversation()
      .withEstablishmentId(establishmentId)
      .withMusicianId(null)
      .withBandId("44444444-4444-4444-8444-444444444444")
      .build();
    convRepo.findById.mockResolvedValue(conversation);

    await handler.handleMessageSent(makeEvent(establishmentId));

    expect(gateway.notifyChatMessage).not.toHaveBeenCalled();
    expect(pushNotificationService.send).not.toHaveBeenCalled();
  });

  it("should not send a push when the musician has no push_token, but still notify the gateway", async () => {
    const conversation = Conversation.fake()
      .aConversation()
      .withEstablishmentId(establishmentId)
      .withMusicianId(musicianId)
      .build();
    convRepo.findById.mockResolvedValue(conversation);
    musicianRepo.findById.mockResolvedValue(
      Musician.fake().aMusician().build(),
    );

    await handler.handleMessageSent(makeEvent(establishmentId));

    expect(gateway.notifyChatMessage).toHaveBeenCalledTimes(1);
    expect(pushNotificationService.send).not.toHaveBeenCalled();
  });

  it("should do nothing when the conversation does not exist", async () => {
    convRepo.findById.mockResolvedValue(null);

    await handler.handleMessageSent(makeEvent(establishmentId));

    expect(gateway.notifyChatMessage).not.toHaveBeenCalled();
    expect(pushNotificationService.send).not.toHaveBeenCalled();
  });
});
