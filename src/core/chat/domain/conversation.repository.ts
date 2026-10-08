import { IRepository } from "../../shared/domain/repository/repository-interface";
import { Conversation, ConversationId } from "./conversation.aggregate";

export interface IConversationRepository extends IRepository<
  Conversation,
  ConversationId
> {
  findByInquiryId(inquiry_id: string): Promise<Conversation | null>;
  /**
   * A conversa aberta por uma proposta de show.
   *
   * ⚠️ É um método PRÓPRIO, e não um `findByNegotiation({inquiry_id?,
   * booking_id?})`: as duas colunas são `@unique` separadas, e uma assinatura
   * com os dois opcionais aceitaria a chamada sem nenhum dos dois — que
   * devolveria a primeira conversa que o banco encontrasse.
   */
  findByBookingId(booking_id: string): Promise<Conversation | null>;
  findByParticipant(participant_ids: string[]): Promise<Conversation[]>;
}
