import { PrismaClient } from "@prisma/client";

import { Conversation, ConversationId } from "../../../../domain/conversation.aggregate";
import { ConversationModelMapper } from "../conversation-model-mapper";
import { ConversationPrismaRepository } from "../conversation-prisma.repository";

describe("ConversationPrismaRepository", () => {
  let repository: ConversationPrismaRepository;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = {
      conversation: {
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    } as any;
    repository = new ConversationPrismaRepository(prisma);
  });

  describe("insert", () => {
    it("should insert a conversation", async () => {
      const conversation = Conversation.fake().aConversation().build();
      const modelProps = ConversationModelMapper.toModel(conversation);

      await repository.insert(conversation);

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: modelProps,
      });
    });
  });

  describe("findByInquiryId", () => {
    it("should return a conversation when found", async () => {
      const conversation = Conversation.fake().aConversation().build();
      const modelProps = ConversationModelMapper.toModel(conversation);

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        modelProps,
      );

      const result = await repository.findByInquiryId(
        conversation.inquiry_id,
      );

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { inquiry_id: conversation.inquiry_id },
      });
      expect(result?.conversation_id.id).toBe(conversation.conversation_id.id);
    });

    it("should return null when not found", async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByInquiryId("non-existing");

      expect(result).toBeNull();
    });
  });

  describe("findByParticipant", () => {
    // Regressão do bug real: a implementação original só filtrava por
    // musician_id/band_id, omitindo establishment_id — um estabelecimento
    // nunca via as próprias conversas via GET /conversations em produção.
    // O repositório in-memory (usado pelo chat.int-spec.ts) sempre teve os
    // três campos, por isso os testes de integração nunca pegaram o bug.
    it("should query by musician_id, band_id, and establishment_id (all three OR branches)", async () => {
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue([]);

      await repository.findByParticipant("participant-id");

      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { musician_id: "participant-id" },
            { band_id: "participant-id" },
            { establishment_id: "participant-id" },
          ],
        },
      });
    });

    it("should map returned models to Conversation entities", async () => {
      const conversation = Conversation.fake().aConversation().build();
      const modelProps = ConversationModelMapper.toModel(conversation);
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue([
        modelProps,
      ]);

      const result = await repository.findByParticipant(
        conversation.musician_id!,
      );

      expect(result).toHaveLength(1);
      expect(result[0].conversation_id.id).toBe(
        conversation.conversation_id.id,
      );
    });

    it("should find a conversation by its establishment_id (the previously-missing branch)", async () => {
      const conversation = Conversation.fake().aConversation().build();
      const modelProps = ConversationModelMapper.toModel(conversation);
      (prisma.conversation.findMany as jest.Mock).mockResolvedValue([
        modelProps,
      ]);

      const result = await repository.findByParticipant(
        conversation.establishment_id,
      );

      expect(result).toHaveLength(1);
      expect(result[0].establishment_id).toBe(conversation.establishment_id);
    });
  });

  describe("findById", () => {
    it("should return a conversation when found", async () => {
      const conversation = Conversation.fake().aConversation().build();
      const modelProps = ConversationModelMapper.toModel(conversation);

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        modelProps,
      );

      const result = await repository.findById(conversation.conversation_id);

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: conversation.conversation_id.id },
      });
      expect(result?.conversation_id.id).toBe(conversation.conversation_id.id);
    });

    it("should return null when not found", async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById(new ConversationId());

      expect(result).toBeNull();
    });
  });
});
