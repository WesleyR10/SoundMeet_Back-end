import { IRepository } from "../../shared/domain/repository/repository-interface";
import { Conversation, ConversationId } from "./conversation.aggregate";

export interface IConversationRepository
  extends IRepository<Conversation, ConversationId> {
  findByInquiryId(inquiry_id: string): Promise<Conversation | null>;
  findByParticipant(participant_id: string): Promise<Conversation[]>;
}
