import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  Conversation,
  ConversationId,
} from "../../../domain/conversation.aggregate";

export type ConversationModel = {
  id: string;
  inquiry_id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export class ConversationModelMapper {
  static toModel(entity: Conversation): ConversationModel {
    return {
      id: entity.conversation_id.id,
      inquiry_id: entity.inquiry_id,
      establishment_id: entity.establishment_id,
      musician_id: entity.musician_id,
      band_id: entity.band_id,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: ConversationModel): Conversation {
    try {
      const conversation = new Conversation({
        conversation_id: new ConversationId(model.id),
        inquiry_id: model.inquiry_id,
        establishment_id: model.establishment_id,
        musician_id: model.musician_id,
        band_id: model.band_id,
        created_at: model.created_at,
        updated_at: model.updated_at,
      });

      conversation.validate();

      if (conversation.notification.hasErrors()) {
        throw new LoadEntityError(conversation.notification.toJSON());
      }

      return conversation;
    } catch (error: any) {
      if (error instanceof LoadEntityError) {
        throw error;
      }
      throw new LoadEntityError([
        {
          conversation: [
            error?.message ??
              `Conversation ${model.id} has invalid data in database`,
          ],
        },
      ]);
    }
  }
}
