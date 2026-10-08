import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  Conversation,
  ConversationId,
} from "../../../domain/conversation.aggregate";
import { IConversationRepository } from "../../../domain/conversation.repository";
import { IMessageRepository } from "../../../domain/message.repository";

export type MarkAsReadInput = {
  conversation_id: string;
  // Identidades candidatas do ator — ver SendMessageInput.sender_ids.
  reader_ids: string[];
};

export type MarkAsReadOutput = {
  // Identidade exata que leu (resolvida contra esta conversa) — o
  // controller precisa dela pra emitir `messages.read` com o reader_id
  // correto, já que não pode mais assumi-lo antes de chamar o use case.
  reader_id: string;
};

export class MarkAsReadUseCase implements IUseCase<
  MarkAsReadInput,
  MarkAsReadOutput
> {
  constructor(
    private readonly convRepo: IConversationRepository,
    private readonly msgRepo: IMessageRepository,
  ) {}

  async execute(input: MarkAsReadInput): Promise<MarkAsReadOutput> {
    const conv = await this.convRepo.findById(
      new ConversationId(input.conversation_id),
    );

    if (!conv) {
      throw new NotFoundError(input.conversation_id, Conversation);
    }

    // Marcar como lida dispara `messages.read` na room da conversa: sem esta
    // checagem, um terceiro autenticado alterava estado de leitura alheio.
    const reader_id = conv.resolveParticipantId(...input.reader_ids);
    if (!reader_id) {
      throw new ForbiddenException(
        `Reader is not a participant of conversation ${input.conversation_id}`,
      );
    }

    await this.msgRepo.markAllAsRead(input.conversation_id, reader_id);

    return { reader_id };
  }
}
