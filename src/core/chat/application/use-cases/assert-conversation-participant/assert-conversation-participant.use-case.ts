import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  Conversation,
  ConversationId,
} from "../../../domain/conversation.aggregate";
import { IConversationRepository } from "../../../domain/conversation.repository";

export type AssertConversationParticipantInput = {
  conversation_id: string;
  /**
   * Identidades derivadas do JWT (sub + establishment_ids + band_ids). Nunca
   * um id vindo do payload do cliente.
   */
  participant_ids: string[];
  is_admin?: boolean;
};

export type AssertConversationParticipantOutput = {
  conversation: ReturnType<Conversation["toJSON"]>;
};

/**
 * Autoriza o acesso a uma conversa sem carregar mensagens — feito para o
 * handshake do WebSocket, onde entrar na room já basta para receber
 * `message.new` e `messages.read`. Reusa a mesma política do
 * `GetConversationUseCase` via `Conversation.hasParticipant`.
 */
export class AssertConversationParticipantUseCase implements IUseCase<
  AssertConversationParticipantInput,
  AssertConversationParticipantOutput
> {
  constructor(private readonly convRepo: IConversationRepository) {}

  async execute(
    input: AssertConversationParticipantInput,
  ): Promise<AssertConversationParticipantOutput> {
    const conv = await this.convRepo.findById(
      new ConversationId(input.conversation_id),
    );

    if (!conv) {
      throw new NotFoundError(input.conversation_id, Conversation);
    }

    if (!input.is_admin && !conv.hasParticipant(...input.participant_ids)) {
      throw new ForbiddenException(
        `Requester is not a participant of conversation ${input.conversation_id}`,
      );
    }

    return { conversation: conv.toJSON() };
  }
}
