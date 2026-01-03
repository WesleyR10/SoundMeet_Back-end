import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { InquiryId } from "../inquiry.aggregate";

export type InquiryRejectedEventProps = {
  inquiry_id: InquiryId;
  rejected_at: Date;
  reason: string | null;
};

export class InquiryRejectedIntegrationEvent implements IIntegrationEvent<{
  inquiry_id: string;
  rejected_at: Date;
  reason: string | null;
}> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "inquiry.rejected";
  payload: { inquiry_id: string; rejected_at: Date; reason: string | null };

  constructor(props: {
    inquiry_id: string;
    rejected_at: Date;
    reason: string | null;
  }) {
    this.payload = props;
  }
}

export class InquiryRejectedEvent implements IDomainEvent {
  readonly aggregate_id: InquiryId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly rejected_at: Date;
  readonly reason: string | null;

  constructor(props: InquiryRejectedEventProps) {
    this.aggregate_id = props.inquiry_id;
    this.rejected_at = props.rejected_at;
    this.reason = props.reason;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new InquiryRejectedIntegrationEvent({
      inquiry_id: this.aggregate_id.id,
      rejected_at: this.rejected_at,
      reason: this.reason,
    });
  }
}
