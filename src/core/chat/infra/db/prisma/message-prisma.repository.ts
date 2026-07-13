import { PrismaClient } from "@prisma/client";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { Message, MessageId } from "../../../domain/message.aggregate";
import {
  IMessageRepository,
  MessagePage,
  MessagePageOptions,
} from "../../../domain/message.repository";
import { MessageModelMapper } from "./message-model-mapper";

export class MessagePrismaRepository implements IMessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insert(entity: Message): Promise<void> {
    const data = MessageModelMapper.toModel(entity);
    try {
      await this.prisma.message.create({ data });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.message_id.id,
        operation: "message.create",
      });
    }
  }

  async bulkInsert(entities: Message[]): Promise<void> {
    const data = entities.map((e) => MessageModelMapper.toModel(e));
    try {
      await this.prisma.message.createMany({ data });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "message.createMany",
      });
    }
  }

  async update(entity: Message): Promise<void> {
    const id = entity.message_id.id;
    const data = MessageModelMapper.toModel(entity);
    try {
      await this.prisma.message.update({ where: { id }, data });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "message.update",
      });
    }
  }

  async delete(entity_id: MessageId): Promise<void> {
    try {
      await this.prisma.message.delete({ where: { id: entity_id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity_id.id,
        operation: "message.delete",
      });
    }
  }

  async findById(entity_id: MessageId): Promise<Message | null> {
    const model = await this.prisma.message.findUnique({
      where: { id: entity_id.id },
    });
    return model ? MessageModelMapper.toEntity(model) : null;
  }

  async findAll(): Promise<Message[]> {
    const models = await this.prisma.message.findMany();
    return models.map((m) => MessageModelMapper.toEntity(m));
  }

  async findByIds(ids: MessageId[]): Promise<Message[]> {
    const models = await this.prisma.message.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((m) => MessageModelMapper.toEntity(m));
  }

  async existsById(
    ids: MessageId[],
  ): Promise<{ exists: MessageId[]; not_exists: MessageId[] }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existing = await this.prisma.message.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });

    const existingIds = existing.map((m) => new MessageId(m.id));
    const notExistingIds = ids.filter(
      (id) => !existingIds.some((eid) => eid.equals(id)),
    );

    return { exists: existingIds, not_exists: notExistingIds };
  }

  async findByConversationId(
    conversation_id: string,
    options: MessagePageOptions,
  ): Promise<MessagePage> {
    const rows = await this.prisma.message.findMany({
      where: { conversation_id },
      orderBy: { created_at: "asc" },
      take: options.limit + 1,
      ...(options.cursor
        ? { cursor: { id: options.cursor }, skip: 1 }
        : {}),
    });

    const hasNext = rows.length > options.limit;
    if (hasNext) rows.pop();

    const next_cursor =
      hasNext && rows.length > 0 ? rows[rows.length - 1].id : null;

    return {
      messages: rows.map((m) => MessageModelMapper.toEntity(m)),
      next_cursor,
    };
  }

  async markAllAsRead(
    conversation_id: string,
    reader_id: string,
  ): Promise<void> {
    await this.prisma.message.updateMany({
      where: {
        conversation_id,
        NOT: { sender_id: reader_id },
        status: { not: "read" },
      },
      data: {
        status: "read",
        read_at: new Date(),
      },
    });
  }

  async findLastMessagesByConversationIds(
    conversation_ids: string[],
  ): Promise<Map<string, Message>> {
    if (!conversation_ids.length) return new Map();

    // distinct + orderBy: Prisma retorna a 1ª linha (segundo o orderBy) de
    // cada valor distinto de conversation_id — dá a última mensagem por
    // conversa numa única query, sem 1 findFirst por conversa.
    const rows = await this.prisma.message.findMany({
      where: { conversation_id: { in: conversation_ids } },
      orderBy: { created_at: "desc" },
      distinct: ["conversation_id"],
    });

    return new Map(
      rows.map((m) => [m.conversation_id, MessageModelMapper.toEntity(m)]),
    );
  }

  async countUnreadByConversationIds(
    conversation_ids: string[],
    reader_id: string,
  ): Promise<Map<string, number>> {
    if (!conversation_ids.length) return new Map();

    const groups = await this.prisma.message.groupBy({
      by: ["conversation_id"],
      where: {
        conversation_id: { in: conversation_ids },
        NOT: { sender_id: reader_id },
        status: { not: "read" },
      },
      _count: { _all: true },
    });

    return new Map(groups.map((g) => [g.conversation_id, g._count._all]));
  }

  getEntity(): new (...args: any[]) => Message {
    return Message;
  }
}
