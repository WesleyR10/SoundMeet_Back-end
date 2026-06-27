import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Conversation, ConversationId } from "../../../domain/conversation.aggregate";
import { IConversationRepository } from "../../../domain/conversation.repository";
import { Message, SenderType } from "../../../domain/message.aggregate";
import { IMessageRepository } from "../../../domain/message.repository";

export type SendMessageInput = {
  conversation_id: string;
  sender_id: string;
  sender_type: SenderType;
  content: string;
};

export type SendMessageOutput = ReturnType<Message["toJSON"]>;

export class SendMessageUseCase
  implements IUseCase<SendMessageInput, SendMessageOutput>
{
  constructor(
    private readonly convRepo: IConversationRepository,
    private readonly msgRepo: IMessageRepository,
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    const conv = await this.convRepo.findById(
      new ConversationId(input.conversation_id),
    );

    if (!conv) {
      throw new NotFoundError(input.conversation_id, Conversation);
    }

    const isParticipant =
      conv.establishment_id === input.sender_id ||
      conv.musician_id === input.sender_id ||
      conv.band_id === input.sender_id;

    if (!isParticipant) {
      throw new ForbiddenException(
        `Sender ${input.sender_id} is not a participant of conversation ${input.conversation_id}`,
      );
    }

    const msg = Message.create({
      conversation_id: input.conversation_id,
      sender_id: input.sender_id,
      sender_type: input.sender_type,
      content: input.content,
    });

    await this.msgRepo.insert(msg);

    return msg.toJSON();
  }
}
