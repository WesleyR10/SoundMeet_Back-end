import { ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import {
  GetConversationUseCase,
  ListConversationsUseCase,
  MarkAsReadUseCase,
  SendMessageUseCase,
} from "../../../core/chat/application/use-cases";
import { OpenConversationUseCase } from "../../../core/chat/application/use-cases/open-conversation/open-conversation.use-case";
import { Conversation } from "../../../core/chat/domain/conversation.aggregate";
import { IConversationRepository } from "../../../core/chat/domain/conversation.repository";
import { IMessageRepository } from "../../../core/chat/domain/message.repository";
import { ConversationInMemoryRepository } from "../../../core/chat/infra/db/in-memory/conversation-in-memory.repository";
import { MessageInMemoryRepository } from "../../../core/chat/infra/db/in-memory/message-in-memory.repository";
import { AuthenticatedUser } from "../../auth-module/interfaces/authenticated-user.interface";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { ChatController } from "../chat.controller";
import { ChatGateway } from "../chat.gateway";

const MUSICIAN_USER: AuthenticatedUser = {
  userId: "00000000-0000-0000-0000-000000000001",
  roles: ["musician"],
  bandIds: [],
  establishmentIds: [],
  isAdmin: false,
};

const ESTABLISHMENT_USER: AuthenticatedUser = {
  userId: "00000000-0000-0000-0000-000000000002",
  roles: ["establishment"],
  bandIds: [],
  establishmentIds: ["00000000-0000-0000-0000-000000000002"],
  isAdmin: false,
};

const OUTSIDER_USER: AuthenticatedUser = {
  userId: "00000000-0000-0000-0000-000000000099",
  roles: ["musician"],
  bandIds: [],
  establishmentIds: [],
  isAdmin: false,
};

describe("ChatController Integration Tests", () => {
  let controller: ChatController;
  let convRepo: ConversationInMemoryRepository;
  let msgRepo: MessageInMemoryRepository;
  let testConv: Conversation;

  const chatGatewayMock = {
    emitNewMessage: jest.fn(),
    emitMessagesRead: jest.fn(),
  };

  beforeEach(async () => {
    convRepo = new ConversationInMemoryRepository();
    msgRepo = new MessageInMemoryRepository();

    const moduleBuilder = Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: ChatGateway, useValue: chatGatewayMock },
        {
          provide: "IConversationRepository",
          useValue: convRepo,
        },
        {
          provide: "IMessageRepository",
          useValue: msgRepo,
        },
        {
          provide: OpenConversationUseCase,
          useFactory: (repo: IConversationRepository) =>
            new OpenConversationUseCase(repo),
          inject: ["IConversationRepository"],
        },
        {
          provide: SendMessageUseCase,
          useFactory: (
            cRepo: IConversationRepository,
            mRepo: IMessageRepository,
          ) => new SendMessageUseCase(cRepo, mRepo),
          inject: ["IConversationRepository", "IMessageRepository"],
        },
        {
          provide: GetConversationUseCase,
          useFactory: (
            cRepo: IConversationRepository,
            mRepo: IMessageRepository,
          ) => new GetConversationUseCase(cRepo, mRepo),
          inject: ["IConversationRepository", "IMessageRepository"],
        },
        {
          provide: ListConversationsUseCase,
          useFactory: (repo: IConversationRepository) =>
            new ListConversationsUseCase(repo),
          inject: ["IConversationRepository"],
        },
        {
          provide: MarkAsReadUseCase,
          useFactory: (
            cRepo: IConversationRepository,
            mRepo: IMessageRepository,
          ) => new MarkAsReadUseCase(cRepo, mRepo),
          inject: ["IConversationRepository", "IMessageRepository"],
        },
      ],
    });

    const module: TestingModule =
      await applyAuthGuardMocks(moduleBuilder).compile();

    controller = module.get<ChatController>(ChatController);

    // Conversa entre estabelecimento e músico
    testConv = Conversation.fake()
      .aConversation()
      .withEstablishmentId(ESTABLISHMENT_USER.establishmentIds[0])
      .withMusicianId(MUSICIAN_USER.userId)
      .build();
    await convRepo.insert(testConv);

    jest.clearAllMocks();
  });

  it("should be defined with all use-cases wired", () => {
    expect(controller).toBeDefined();
    expect(controller["sendMessageUseCase"]).toBeInstanceOf(SendMessageUseCase);
    expect(controller["getConversationUseCase"]).toBeInstanceOf(
      GetConversationUseCase,
    );
    expect(controller["listConversationsUseCase"]).toBeInstanceOf(
      ListConversationsUseCase,
    );
    expect(controller["markAsReadUseCase"]).toBeInstanceOf(MarkAsReadUseCase);
  });

  describe("POST /conversations/:id/messages — sendMessage", () => {
    it("should send a message as musician participant and emit WebSocket event", async () => {
      const result = await controller.sendMessage(
        testConv.conversation_id.id,
        { content: "Topamos o set!" },
        MUSICIAN_USER,
      );

      expect(result.message_id).toBeDefined();
      expect(result.content).toBe("Topamos o set!");
      expect(result.sender_type).toBe("musician");
      expect(result.sender_id).toBe(MUSICIAN_USER.userId);
      expect(msgRepo.items).toHaveLength(1);
      expect(chatGatewayMock.emitNewMessage).toHaveBeenCalledWith(
        testConv.conversation_id.id,
        expect.objectContaining({ content: "Topamos o set!" }),
      );
    });

    it("should send a message as establishment participant", async () => {
      const result = await controller.sendMessage(
        testConv.conversation_id.id,
        { content: "Olá! Temos interesse." },
        ESTABLISHMENT_USER,
      );

      expect(result.sender_type).toBe("establishment");
      expect(result.sender_id).toBe(ESTABLISHMENT_USER.establishmentIds[0]);
    });

    it("should throw ForbiddenException when sender is not a participant", async () => {
      await expect(
        controller.sendMessage(
          testConv.conversation_id.id,
          { content: "intruso" },
          OUTSIDER_USER,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(msgRepo.items).toHaveLength(0);
      expect(chatGatewayMock.emitNewMessage).not.toHaveBeenCalled();
    });

    it("should throw when conversation does not exist", async () => {
      await expect(
        controller.sendMessage(
          "00000000-0000-0000-0000-000000000000",
          { content: "hello" },
          MUSICIAN_USER,
        ),
      ).rejects.toThrow();
    });
  });

  describe("GET /conversations/:id/messages — getConversation", () => {
    it("should return conversation data and messages list", async () => {
      await controller.sendMessage(
        testConv.conversation_id.id,
        { content: "Primeira" },
        MUSICIAN_USER,
      );
      await controller.sendMessage(
        testConv.conversation_id.id,
        { content: "Segunda" },
        ESTABLISHMENT_USER,
      );

      const result = await controller.getConversation(
        testConv.conversation_id.id,
        {},
        MUSICIAN_USER,
      );

      expect(result.conversation.conversation_id).toBe(
        testConv.conversation_id.id,
      );
      expect(result.messages).toHaveLength(2);
      expect(result.next_cursor).toBeNull();
    });

    it("should support cursor pagination", async () => {
      for (let i = 1; i <= 5; i++) {
        await controller.sendMessage(
          testConv.conversation_id.id,
          { content: `Mensagem ${i}` },
          MUSICIAN_USER,
        );
      }

      const page1 = await controller.getConversation(
        testConv.conversation_id.id,
        { limit: 3 },
        MUSICIAN_USER,
      );

      expect(page1.messages).toHaveLength(3);
      expect(page1.next_cursor).not.toBeNull();

      const page2 = await controller.getConversation(
        testConv.conversation_id.id,
        { limit: 3, cursor: page1.next_cursor! },
        MUSICIAN_USER,
      );

      expect(page2.messages).toHaveLength(2);
      expect(page2.next_cursor).toBeNull();
    });

    it("should throw ForbiddenException for non-participant requester", async () => {
      await expect(
        controller.getConversation(
          testConv.conversation_id.id,
          {},
          OUTSIDER_USER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("GET /conversations — listConversations", () => {
    it("should return conversations for the authenticated musician", async () => {
      const result = await controller.listConversations(MUSICIAN_USER);

      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0].conversation_id).toBe(
        testConv.conversation_id.id,
      );
    });

    it("should return conversations for the authenticated establishment", async () => {
      const result = await controller.listConversations(ESTABLISHMENT_USER);

      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0].establishment_id).toBe(
        ESTABLISHMENT_USER.establishmentIds[0],
      );
    });

    it("should return empty list when user has no conversations", async () => {
      const result = await controller.listConversations(OUTSIDER_USER);
      expect(result.conversations).toHaveLength(0);
    });
  });

  describe("PATCH /conversations/:id/read — markAsRead", () => {
    it("should mark messages as read and emit WebSocket event", async () => {
      await controller.sendMessage(
        testConv.conversation_id.id,
        { content: "Oi" },
        MUSICIAN_USER,
      );

      const result = await controller.markAsRead(
        testConv.conversation_id.id,
        ESTABLISHMENT_USER,
      );

      expect(result).toEqual({ ok: true });
      expect(chatGatewayMock.emitMessagesRead).toHaveBeenCalledWith(
        testConv.conversation_id.id,
        ESTABLISHMENT_USER.establishmentIds[0],
      );
    });

    it("should throw when conversation does not exist", async () => {
      await expect(
        controller.markAsRead(
          "00000000-0000-0000-0000-000000000000",
          MUSICIAN_USER,
        ),
      ).rejects.toThrow();
    });
  });
});
