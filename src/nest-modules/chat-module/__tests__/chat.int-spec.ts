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
import {
  Establishment,
  EstablishmentId,
} from "../../../core/establishment/domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../core/establishment/infra/db/in-memory/establishment-in-memory.repository";
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
  userId: "00000000-0000-4000-8000-000000000002",
  roles: ["establishment"],
  bandIds: [],
  establishmentIds: ["00000000-0000-4000-8000-000000000002"],
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
  let establishmentRepo: EstablishmentInMemoryRepository;
  let testConv: Conversation;
  let testEstablishment: Establishment;

  const chatGatewayMock = {
    emitNewMessage: jest.fn(),
    emitMessagesRead: jest.fn(),
  };

  beforeEach(async () => {
    convRepo = new ConversationInMemoryRepository();
    msgRepo = new MessageInMemoryRepository();
    establishmentRepo = new EstablishmentInMemoryRepository();

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
          provide: "EstablishmentRepository",
          useValue: establishmentRepo,
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
          useFactory: (
            cRepo: IConversationRepository,
            mRepo: IMessageRepository,
          ) => new ListConversationsUseCase(cRepo, mRepo),
          inject: ["IConversationRepository", "IMessageRepository"],
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
    testEstablishment = Establishment.fake()
      .aEstablishment()
      .withEstablishmentId(
        new EstablishmentId(ESTABLISHMENT_USER.establishmentIds[0]),
      )
      .build();
    await establishmentRepo.insert(testEstablishment);

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

    it("should enrich each conversation with establishment name/avatar", async () => {
      const result = await controller.listConversations(MUSICIAN_USER);

      expect(result.conversations[0].establishment).toEqual({
        id: testEstablishment.establishment_id.id,
        name: testEstablishment.name,
        avatar: testEstablishment.avatar,
      });
    });

    // Regressão: ConversationPrisma pode conter um establishment_id que
    // passa na validação (mais permissiva) do agregado Conversation
    // (class-validator @IsUUID("4")) mas falha na validação estrita do VO
    // EstablishmentId (uuid package, exige nibble de versão 1-5 e variante
    // 8/9/a/b) — já aconteceu de verdade com um fixture de teste durante
    // esta revisão. Antes do fix, isso derrubava GET /conversations inteiro
    // com InvalidUuidError pra QUALQUER conversa do músico, não só a
    // malformada.
    it("should not throw when a conversation has a malformed establishment_id — degrades that conversation's establishment to null", async () => {
      const malformedConv = Conversation.fake()
        .aConversation()
        .withEstablishmentId("00000000-0000-0000-0000-000000000099")
        .withMusicianId(MUSICIAN_USER.userId)
        .build();
      await convRepo.insert(malformedConv);

      const result = await controller.listConversations(MUSICIAN_USER);

      expect(result.conversations).toHaveLength(2);
      const malformedResult = result.conversations.find(
        (c) => c.conversation_id === malformedConv.conversation_id.id,
      );
      expect(malformedResult?.establishment).toBeNull();
      // A conversa "boa" (testConv) não é afetada pela malformada.
      const goodResult = result.conversations.find(
        (c) => c.conversation_id === testConv.conversation_id.id,
      );
      expect(goodResult?.establishment).not.toBeNull();
    });

    it("should not throw and should return establishment: null for all conversations when the establishment repository fails", async () => {
      jest
        .spyOn(establishmentRepo, "findByIds")
        .mockRejectedValueOnce(new Error("DB timeout"));

      const result = await controller.listConversations(MUSICIAN_USER);

      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0].establishment).toBeNull();
    });

    it("should return last_message and unread_count for each conversation", async () => {
      await controller.sendMessage(
        testConv.conversation_id.id,
        { content: "Proposta de cachê" },
        ESTABLISHMENT_USER,
      );

      const result = await controller.listConversations(MUSICIAN_USER);

      expect(result.conversations[0].last_message).toMatchObject({
        content: "Proposta de cachê",
      });
      expect(result.conversations[0].unread_count).toBe(1);
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
