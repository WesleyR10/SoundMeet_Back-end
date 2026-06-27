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
}
