import { Uuid } from "../../../shared/domain";
import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { ContractId } from "../contract.aggregate";

export type ContractIssuedEventProps = {
  aggregate_id: ContractId;
  booking_id: Uuid;
  establishment_id: Uuid;
  musician_id: Uuid | null;
  band_id: Uuid | null;
  template_version: string;
  issued_at: Date;
};

type ContractIssuedPayload = {
  contract_id: string;
  booking_id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  template_version: string;
  issued_at: Date;
};

export class ContractIssuedIntegrationEvent implements IIntegrationEvent<ContractIssuedPayload> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "contract.issued";
  payload: ContractIssuedPayload;

  constructor(props: ContractIssuedPayload) {
    this.payload = props;
  }
}

export class ContractIssuedEvent implements IDomainEvent {
  readonly aggregate_id: ContractId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly booking_id: Uuid;
  readonly establishment_id: Uuid;
  readonly musician_id: Uuid | null;
  readonly band_id: Uuid | null;
  readonly template_version: string;
  readonly issued_at: Date;

  constructor(props: ContractIssuedEventProps) {
    this.aggregate_id = props.aggregate_id;
    this.booking_id = props.booking_id;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.template_version = props.template_version;
    this.issued_at = props.issued_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new ContractIssuedIntegrationEvent({
      contract_id: this.aggregate_id.id,
      booking_id: this.booking_id.id,
      establishment_id: this.establishment_id.id,
      musician_id: this.musician_id?.id ?? null,
      band_id: this.band_id?.id ?? null,
      template_version: this.template_version,
      issued_at: this.issued_at,
    });
  }
}
