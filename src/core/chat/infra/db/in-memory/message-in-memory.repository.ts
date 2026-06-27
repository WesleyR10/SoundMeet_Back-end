import { InMemoryRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Message, MessageId } from "../../../domain/message.aggregate";
import {
  IMessageRepository,
  MessagePage,
  MessagePageOptions,
} from "../../../domain/message.repository";

export class MessageInMemoryRepository
  extends InMemoryRepository<Message, MessageId>
  implements IMessageRepository
{
  getEntity(): new (...args: any[]) => Message {
    return Message;
  }

  async findByConversationId(
    conversation_id: string,
    options: MessagePageOptions,
  ): Promise<MessagePage> {
    const all = this.items
      .filter((m) => m.conversation_id === conversation_id)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

    let startIndex = 0;
    if (options.cursor) {
      const cursorIndex = all.findIndex(
        (m) => m.message_id.id === options.cursor,
      );
      startIndex = cursorIndex === -1 ? 0 : cursorIndex + 1;
    }

    const sliced = all.slice(startIndex, startIndex + options.limit + 1);
    const hasNext = sliced.length > options.limit;
    if (hasNext) sliced.pop();

    const next_cursor =
      hasNext && sliced.length > 0
        ? sliced[sliced.length - 1].message_id.id
        : null;

    return { messages: sliced, next_cursor };
  }

  async markAllAsRead(
    conversation_id: string,
    reader_id: string,
  ): Promise<void> {
    this.items
      .filter(
        (m) =>
          m.conversation_id === conversation_id &&
          m.sender_id !== reader_id &&
          m.status !== "read",
      )
      .forEach((m) => m.markRead());
  }
}
