import { IUseCase } from "../../../../shared/application/use-case.interface";
import { Conversation } from "../../../domain/conversation.aggregate";
import { IConversationRepository } from "../../../domain/conversation.repository";

export type ListConversationsInput = {
  participant_id: string;
};

export type ListConversationsOutput = {
  conversations: ReturnType<Conversation["toJSON"]>[];
};

export class ListConversationsUseCase
  implements IUseCase<ListConversationsInput, ListConversationsOutput>
{
  constructor(private readonly convRepo: IConversationRepository) {}

  async execute(
    input: ListConversationsInput,
  ): Promise<ListConversationsOutput> {
    const conversations = await this.convRepo.findByParticipant(
      input.participant_id,
    );

    return {
      conversations: conversations.map((c) => c.toJSON()),
    };
  }
}
