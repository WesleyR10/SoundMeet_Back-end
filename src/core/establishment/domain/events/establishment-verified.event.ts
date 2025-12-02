import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { EstablishmentId } from "../establishment.aggregate";

export type EstablishmentVerifiedEventProps = {
  establishment_id: EstablishmentId;
  verified_at: Date;
};

export class EstablishmentVerifiedEvent implements IDomainEvent {
  readonly aggregate_id: EstablishmentId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly verified_at: Date;

  constructor(props: EstablishmentVerifiedEventProps) {
    this.aggregate_id = props.establishment_id;
    this.verified_at = props.verified_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
