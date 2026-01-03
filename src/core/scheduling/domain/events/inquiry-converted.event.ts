import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { InquiryId } from "../inquiry.aggregate";

export type InquiryConvertedEventProps = {
  inquiry_id: InquiryId;
  booking_id: string;
  converted_at: Date;
};

export class InquiryConvertedIntegrationEvent implements IIntegrationEvent<{
  inquiry_id: string;
  booking_id: string;
  converted_at: Date;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "inquiry.converted";
  payload: { inquiry_id: string; booking_id: string; converted_at: Date };

  constructor(props: {
    inquiry_id: string;
    booking_id: string;
    converted_at: Date;
  }) {
    this.payload = props;
  }
}

export class InquiryConvertedEvent implements IDomainEvent {
  readonly aggregate_id: InquiryId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly booking_id: string;
  readonly converted_at: Date;

  constructor(props: InquiryConvertedEventProps) {
    this.aggregate_id = props.inquiry_id;
    this.booking_id = props.booking_id;
    this.converted_at = props.converted_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new InquiryConvertedIntegrationEvent({
      inquiry_id: this.aggregate_id.id,
      booking_id: this.booking_id,
      converted_at: this.converted_at,
    });
  }
}
