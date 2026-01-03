import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { InquiryId } from "../inquiry.aggregate";

export type InquiryCreatedEventProps = {
  inquiry_id: InquiryId;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  event_id: string | null;
  subject: string | null;
  expires_at: Date | null;
  created_at: Date;
};

export class InquiryCreatedIntegrationEvent implements IIntegrationEvent<{
  inquiry_id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  event_id: string | null;
  subject: string | null;
  expires_at: Date | null;
  created_at: Date;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "inquiry.created";
  payload: {
    inquiry_id: string;
    establishment_id: string;
    musician_id: string | null;
    band_id: string | null;
    event_id: string | null;
    subject: string | null;
    expires_at: Date | null;
    created_at: Date;
  };

  constructor(props: {
    inquiry_id: string;
    establishment_id: string;
    musician_id: string | null;
    band_id: string | null;
    event_id: string | null;
    subject: string | null;
    expires_at: Date | null;
    created_at: Date;
  }) {
    this.payload = props;
  }
}

export class InquiryCreatedEvent implements IDomainEvent {
  readonly aggregate_id: InquiryId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly establishment_id: string;
  readonly musician_id: string | null;
  readonly band_id: string | null;
  readonly event_id: string | null;
  readonly subject: string | null;
  readonly expires_at: Date | null;
  readonly created_at: Date;

  constructor(props: InquiryCreatedEventProps) {
    this.aggregate_id = props.inquiry_id;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.event_id = props.event_id;
    this.subject = props.subject;
    this.expires_at = props.expires_at;
    this.created_at = props.created_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new InquiryCreatedIntegrationEvent({
      inquiry_id: this.aggregate_id.id,
      establishment_id: this.establishment_id,
      musician_id: this.musician_id,
      band_id: this.band_id,
      event_id: this.event_id,
      subject: this.subject,
      expires_at: this.expires_at,
      created_at: this.created_at,
    });
  }
}
