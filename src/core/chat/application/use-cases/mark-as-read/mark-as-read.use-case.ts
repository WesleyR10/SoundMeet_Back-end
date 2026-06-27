import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Conversation, ConversationId } from "../../../domain/conversation.aggregate";
import { IConversationRepository } from "../../../domain/conversation.repository";
import { IMessageRepository } from "../../../domain/message.repository";

export type MarkAsReadInput = {
  conversation_id: string;
  reader_id: string;
};

export class MarkAsReadUseCase
  implements IUseCase<MarkAsReadInput, void>
{
  constructor(
    private readonly convRepo: IConversationRepository,
    private readonly msgRepo: IMessageRepository,
  ) {}

  async execute(input: MarkAsReadInput): Promise<void> {
    const conv = await this.convRepo.findById(
      new ConversationId(input.conversation_id),
    );

    if (!conv) {
      throw new NotFoundError(input.conversation_id, Conversation);
    }

    await this.msgRepo.markAllAsRead(input.conversation_id, input.reader_id);
  }
}
