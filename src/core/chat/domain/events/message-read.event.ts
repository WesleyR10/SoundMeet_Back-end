import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { MessageId } from "../message.aggregate";

export type MessageReadEventProps = {
  message_id: MessageId;
  conversation_id: string;
  reader_id: string;
};

export class MessageReadEvent implements IDomainEvent {
  readonly aggregate_id: MessageId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly conversation_id: string;
  readonly reader_id: string;

  constructor(props: MessageReadEventProps) {
    this.aggregate_id = props.message_id;
    this.conversation_id = props.conversation_id;
    this.reader_id = props.reader_id;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
