import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { EstablishmentId } from "../establishment.aggregate";

export class EstablishmentEmailChangedEvent implements IDomainEvent {
  readonly aggregate_id: EstablishmentId;
  readonly occurred_on: Date;
  readonly event_version: number;
  readonly establishment_id: EstablishmentId;
  readonly new_email: string;
  readonly name: string;

  constructor(props: {
    establishment_id: EstablishmentId;
    new_email: string;
    name: string;
  }) {
    this.aggregate_id = props.establishment_id;
    this.establishment_id = props.establishment_id;
    this.new_email = props.new_email;
    this.name = props.name;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
