import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  Message,
  MessageId,
  MessageStatus,
  SenderType,
} from "../../../domain/message.aggregate";

export type MessageModel = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: string;
  content: string;
  status: string;
  created_at: Date;
  read_at: Date | null;
};

export class MessageModelMapper {
  static toModel(entity: Message): MessageModel {
    return {
      id: entity.message_id.id,
      conversation_id: entity.conversation_id,
      sender_id: entity.sender_id,
      sender_type: entity.sender_type,
      content: entity.content,
      status: entity.status,
      created_at: entity.created_at,
      read_at: entity.read_at,
    };
  }

  static toEntity(model: MessageModel): Message {
    try {
      const message = new Message({
        message_id: new MessageId(model.id),
        conversation_id: model.conversation_id,
        sender_id: model.sender_id,
        sender_type: model.sender_type as SenderType,
        content: model.content,
        status: model.status as MessageStatus,
        created_at: model.created_at,
        read_at: model.read_at,
      });

      message.validate();

      if (message.notification.hasErrors()) {
        throw new LoadEntityError(message.notification.toJSON());
      }

      return message;
    } catch (error: any) {
      if (error instanceof LoadEntityError) {
        throw error;
      }
      throw new LoadEntityError([
        {
          message: [
            error?.message ??
              `Message ${model.id} has invalid data in database`,
          ],
        },
      ]);
    }
  }
}
