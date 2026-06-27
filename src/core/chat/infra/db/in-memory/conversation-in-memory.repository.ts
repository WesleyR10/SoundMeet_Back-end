import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { InMemoryRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Conversation, ConversationId } from "../../../domain/conversation.aggregate";
import { IConversationRepository } from "../../../domain/conversation.repository";

export class ConversationInMemoryRepository
  extends InMemoryRepository<Conversation, ConversationId>
  implements IConversationRepository
{
  getEntity(): new (...args: any[]) => Conversation {
    return Conversation;
  }

  async findByInquiryId(inquiry_id: string): Promise<Conversation | null> {
    return this.items.find((c) => c.inquiry_id === inquiry_id) ?? null;
  }

  async findByParticipant(participant_id: string): Promise<Conversation[]> {
    return this.items.filter(
      (c) =>
        c.establishment_id === participant_id ||
        c.musician_id === participant_id ||
        c.band_id === participant_id,
    );
  }
}
