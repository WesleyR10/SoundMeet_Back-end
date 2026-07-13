import { IUseCase } from "../../../../shared/application/use-case.interface";
import { Conversation } from "../../../domain/conversation.aggregate";
import { IConversationRepository } from "../../../domain/conversation.repository";
import { MessageStatus } from "../../../domain/message.aggregate";
import { IMessageRepository } from "../../../domain/message.repository";

export type ListConversationsInput = {
  participant_id: string;
};

export type ConversationListItem = ReturnType<Conversation["toJSON"]> & {
  last_message: {
    content: string;
    sender_id: string;
    status: MessageStatus;
    created_at: Date;
  } | null;
  unread_count: number;
};

export type ListConversationsOutput = {
  conversations: ConversationListItem[];
};

export class ListConversationsUseCase
  implements IUseCase<ListConversationsInput, ListConversationsOutput>
{
  constructor(
    private readonly convRepo: IConversationRepository,
    private readonly msgRepo: IMessageRepository,
  ) {}

  async execute(
    input: ListConversationsInput,
  ): Promise<ListConversationsOutput> {
    const conversations = await this.convRepo.findByParticipant(
      input.participant_id,
    );

    if (!conversations.length) {
      return { conversations: [] };
    }

    const ids = conversations.map((c) => c.conversation_id.id);
    const [lastMessages, unreadCounts] = await Promise.all([
      this.msgRepo.findLastMessagesByConversationIds(ids),
      this.msgRepo.countUnreadByConversationIds(ids, input.participant_id),
    ]);

    return {
      conversations: conversations.map((c) => {
        const id = c.conversation_id.id;
        const last = lastMessages.get(id);
        return {
          ...c.toJSON(),
          last_message: last
            ? {
                content: last.content,
                sender_id: last.sender_id,
                status: last.status,
                created_at: last.created_at,
              }
            : null,
          unread_count: unreadCounts.get(id) ?? 0,
        };
      }),
    };
  }
}
