import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { MessageSentEvent } from "./events/message-sent.event";
import { MessageReadEvent } from "./events/message-read.event";
import { MessageValidatorFactory } from "./message.validator";
import { MessageFakeBuilder } from "./message-fake.builder";

export type SenderType = "musician" | "establishment" | "band";
export type MessageStatus = "sent" | "delivered" | "read";

export type MessageConstructorProps = {
  message_id?: MessageId;
  conversation_id: string;
  sender_id: string;
  sender_type: SenderType;
  content: string;
  status?: MessageStatus;
  created_at?: Date;
  read_at?: Date | null;
};

export type MessageCreateCommand = {
  conversation_id: string;
  sender_id: string;
  sender_type: SenderType;
  content: string;
};

export class MessageId extends Uuid {}

export class Message extends AggregateRoot {
  message_id: MessageId;
  conversation_id: string;
  sender_id: string;
  sender_type: SenderType;
  content: string;
  status: MessageStatus;
  created_at: Date;
  read_at: Date | null;

  constructor(props: MessageConstructorProps) {
    super();
    this.message_id = props.message_id ?? new MessageId();
    this.conversation_id = props.conversation_id;
    this.sender_id = props.sender_id;
    this.sender_type = props.sender_type;
    this.content = props.content;
    this.status = props.status ?? "sent";
    this.created_at = props.created_at ?? new Date();
    this.read_at = props.read_at ?? null;
  }

  get entity_id(): MessageId {
    return this.message_id;
  }

  static create(command: MessageCreateCommand): Message {
    const msg = new Message(command);
    msg.validate();
    if (msg.notification.hasErrors()) {
      throw new EntityValidationError(msg.notification.toJSON());
    }
    msg.applyEvent(
      new MessageSentEvent({
        message_id: msg.message_id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
      }),
    );
    return msg;
  }

  markRead(): void {
    if (this.status === "read") {
      return;
    }
    this.status = "read";
    this.read_at = new Date();
    this.applyEvent(
      new MessageReadEvent({
        message_id: this.message_id,
        conversation_id: this.conversation_id,
        reader_id: this.sender_id,
      }),
    );
  }

  validate(fields?: string[]): boolean {
    const validator = MessageValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return MessageFakeBuilder;
  }

  toJSON() {
    return {
      message_id: this.message_id.id,
      conversation_id: this.conversation_id,
      sender_id: this.sender_id,
      sender_type: this.sender_type,
      content: this.content,
      status: this.status,
      created_at: this.created_at,
      read_at: this.read_at,
    };
  }
}
