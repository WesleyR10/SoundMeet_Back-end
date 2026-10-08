import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  Conversation,
  ConversationId,
} from "../../../domain/conversation.aggregate";
import { IConversationRepository } from "../../../domain/conversation.repository";
import { Message, SenderType } from "../../../domain/message.aggregate";
import { IMessageRepository } from "../../../domain/message.repository";

export type SendMessageInput = {
  conversation_id: string;
  // Identidades candidatas do ator (ex.: TODAS as unidades de um dono com
  // mais de um estabelecimento) — o sender_id real é resolvido contra ESTA
  // conversa (`resolveParticipantId`), nunca assumido de antemão pelo
  // chamador. Ver Conversation.resolveParticipantId.
  sender_ids: string[];
  sender_type: SenderType;
  content: string;
};

export type SendMessageOutput = ReturnType<Message["toJSON"]>;

export class SendMessageUseCase implements IUseCase<
  SendMessageInput,
  SendMessageOutput
> {
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

    const sender_id = conv.resolveParticipantId(...input.sender_ids);
    if (!sender_id) {
      throw new ForbiddenException(
        `Sender is not a participant of conversation ${input.conversation_id}`,
      );
    }

    const msg = Message.create({
      conversation_id: input.conversation_id,
      sender_id,
      sender_type: input.sender_type,
      content: input.content,
    });

    await this.msgRepo.insert(msg);

    return msg.toJSON();
  }
}
