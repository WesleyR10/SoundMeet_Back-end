import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { MessageId } from "../message.aggregate";

export type MessageSentEventProps = {
  message_id: MessageId;
  conversation_id: string;
  sender_id: string;
};

export class MessageSentEvent implements IDomainEvent {
  readonly aggregate_id: MessageId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly conversation_id: string;
  readonly sender_id: string;

  constructor(props: MessageSentEventProps) {
    this.aggregate_id = props.message_id;
    this.conversation_id = props.conversation_id;
    this.sender_id = props.sender_id;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
