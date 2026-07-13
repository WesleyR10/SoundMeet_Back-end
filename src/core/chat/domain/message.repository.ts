import { IRepository } from "../../shared/domain/repository/repository-interface";
import { Message, MessageId } from "./message.aggregate";

export type MessagePage = {
  messages: Message[];
  next_cursor: string | null;
};

export type MessagePageOptions = {
  limit: number;
  cursor?: string;
};

export interface IMessageRepository extends IRepository<Message, MessageId> {
  findByConversationId(
    conversation_id: string,
    options: MessagePageOptions,
  ): Promise<MessagePage>;
  markAllAsRead(conversation_id: string, reader_id: string): Promise<void>;
  // Batch lookups usados por ListConversationsUseCase pra montar a lista de
  // conversas com preview/contador sem 1 query por conversa.
  findLastMessagesByConversationIds(
    conversation_ids: string[],
  ): Promise<Map<string, Message>>;
  countUnreadByConversationIds(
    conversation_ids: string[],
    reader_id: string,
  ): Promise<Map<string, number>>;
}
