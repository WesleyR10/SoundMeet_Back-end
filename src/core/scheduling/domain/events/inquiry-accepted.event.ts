import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { InquiryId } from "../inquiry.aggregate";

export type InquiryAcceptedEventProps = {
  inquiry_id: InquiryId;
  accepted_at: Date;
};

export class InquiryAcceptedIntegrationEvent implements IIntegrationEvent<{
  inquiry_id: string;
  accepted_at: Date;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "inquiry.accepted";
  payload: { inquiry_id: string; accepted_at: Date };

  constructor(props: { inquiry_id: string; accepted_at: Date }) {
    this.payload = props;
  }
}

export class InquiryAcceptedEvent implements IDomainEvent {
  readonly aggregate_id: InquiryId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly accepted_at: Date;

  constructor(props: InquiryAcceptedEventProps) {
    this.aggregate_id = props.inquiry_id;
    this.accepted_at = props.accepted_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new InquiryAcceptedIntegrationEvent({
      inquiry_id: this.aggregate_id.id,
      accepted_at: this.accepted_at,
    });
  }
}
