import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Conversation, ConversationId } from "../../../domain/conversation.aggregate";
import { IConversationRepository } from "../../../domain/conversation.repository";
import { Message } from "../../../domain/message.aggregate";
import { IMessageRepository } from "../../../domain/message.repository";

export type GetConversationInput = {
  conversation_id: string;
  requester_id: string;
  cursor?: string;
  limit?: number;
};

export type GetConversationOutput = {
  conversation: ReturnType<Conversation["toJSON"]>;
  messages: ReturnType<Message["toJSON"]>[];
  next_cursor: string | null;
};

export class GetConversationUseCase
  implements IUseCase<GetConversationInput, GetConversationOutput>
{
  constructor(
    private readonly convRepo: IConversationRepository,
    private readonly msgRepo: IMessageRepository,
  ) {}

  async execute(input: GetConversationInput): Promise<GetConversationOutput> {
    const conv = await this.convRepo.findById(
      new ConversationId(input.conversation_id),
    );

    if (!conv) {
      throw new NotFoundError(input.conversation_id, Conversation);
    }

    const isParticipant =
      conv.establishment_id === input.requester_id ||
      conv.musician_id === input.requester_id ||
      conv.band_id === input.requester_id;

    if (!isParticipant) {
      throw new ForbiddenException(
        `Requester ${input.requester_id} is not a participant of conversation ${input.conversation_id}`,
      );
    }

    const { messages, next_cursor } = await this.msgRepo.findByConversationId(
      input.conversation_id,
      { limit: input.limit ?? 50, cursor: input.cursor },
    );

    return {
      conversation: conv.toJSON(),
      messages: messages.map((m) => m.toJSON()),
      next_cursor,
    };
  }
}
