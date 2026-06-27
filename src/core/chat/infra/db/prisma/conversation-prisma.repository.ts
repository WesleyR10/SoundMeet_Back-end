import { PrismaClient } from "@prisma/client";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  Conversation,
  ConversationId,
} from "../../../domain/conversation.aggregate";
import { IConversationRepository } from "../../../domain/conversation.repository";
import { ConversationModelMapper } from "./conversation-model-mapper";

export class ConversationPrismaRepository implements IConversationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insert(entity: Conversation): Promise<void> {
    const data = ConversationModelMapper.toModel(entity);
    try {
      await this.prisma.conversation.create({ data });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.conversation_id.id,
        operation: "conversation.create",
      });
    }
  }

  async bulkInsert(entities: Conversation[]): Promise<void> {
    const data = entities.map((e) => ConversationModelMapper.toModel(e));
    try {
      await this.prisma.conversation.createMany({ data });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "conversation.createMany",
      });
    }
  }

  async update(entity: Conversation): Promise<void> {
    const id = entity.conversation_id.id;
    try {
      await this.prisma.conversation.update({
        where: { id },
        data: { updated_at: new Date() },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "conversation.update",
      });
    }
  }

  async delete(entity_id: ConversationId): Promise<void> {
    try {
      await this.prisma.conversation.delete({ where: { id: entity_id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity_id.id,
        operation: "conversation.delete",
      });
    }
  }

  async findById(entity_id: ConversationId): Promise<Conversation | null> {
    const model = await this.prisma.conversation.findUnique({
      where: { id: entity_id.id },
    });
    return model ? ConversationModelMapper.toEntity(model) : null;
  }

  async findAll(): Promise<Conversation[]> {
    const models = await this.prisma.conversation.findMany();
    return models.map((m) => ConversationModelMapper.toEntity(m));
  }

  async findByIds(ids: ConversationId[]): Promise<Conversation[]> {
    const models = await this.prisma.conversation.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((m) => ConversationModelMapper.toEntity(m));
  }

  async existsById(
    ids: ConversationId[],
  ): Promise<{ exists: ConversationId[]; not_exists: ConversationId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existing = await this.prisma.conversation.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });

    const existingIds = existing.map((m) => new ConversationId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((eid) => eid.equals(id)),
    );

    return { exists: existingIds, not_exists: notExistingIds };
  }

  async findByInquiryId(inquiry_id: string): Promise<Conversation | null> {
    const model = await this.prisma.conversation.findUnique({
      where: { inquiry_id },
    });
    return model ? ConversationModelMapper.toEntity(model) : null;
  }

  async findByParticipant(participant_id: string): Promise<Conversation[]> {
    const models = await this.prisma.conversation.findMany({
      where: {
        OR: [
          { musician_id: participant_id },
          { band_id: participant_id },
        ],
      },
    });
    return models.map((m) => ConversationModelMapper.toEntity(m));
  }

  getEntity(): new (...args: any[]) => Conversation {
    return Conversation;
  }
}
