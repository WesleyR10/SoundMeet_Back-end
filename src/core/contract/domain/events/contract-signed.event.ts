import { Uuid } from "../../../shared/domain";
import {
  IDomainEvent,
  IIntegrationEvent,
} from "../../../shared/domain/events/domain-event.interface";
import { ContractId } from "../contract.aggregate";

export type ContractSignedEventProps = {
  aggregate_id: ContractId;
  booking_id: Uuid;
  signed_at: Date;
};

type ContractSignedPayload = {
  contract_id: string;
  booking_id: string;
  signed_at: Date;
};

export class ContractSignedIntegrationEvent implements IIntegrationEvent<ContractSignedPayload> {
  event_version = 1;
  occurred_on = new Date();
  event_name = "contract.signed";
  payload: ContractSignedPayload;

  constructor(props: ContractSignedPayload) {
    this.payload = props;
  }
}

/**
 * Emitido **apenas** quando as duas partes assinaram.
 *
 * Assinatura parcial não emite evento de propósito: quem escuta este evento
 * gera o certificado e avisa as partes de que o contrato está fechado, e um
 * evento por assinatura obrigaria todo listener a reimplementar a checagem de
 * "já assinaram os dois?".
 */
export class ContractSignedEvent implements IDomainEvent {
  readonly aggregate_id: ContractId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly booking_id: Uuid;
  readonly signed_at: Date;

  constructor(props: ContractSignedEventProps) {
    this.aggregate_id = props.aggregate_id;
    this.booking_id = props.booking_id;
    this.signed_at = props.signed_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }

  getIntegrationEvent() {
    return new ContractSignedIntegrationEvent({
      contract_id: this.aggregate_id.id,
      booking_id: this.booking_id.id,
      signed_at: this.signed_at,
    });
  }
}
