import { Uuid } from "../../../shared/domain";
import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { ContractId } from "../contract.aggregate";

export type ContractAnnulledEventProps = {
  aggregate_id: ContractId;
  booking_id: Uuid;
  reason: string;
  annulled_at: Date;
};

/**
 * Anulação de contrato ainda não assinado por ambas as partes.
 *
 * Sem evento de integração: a anulação é ato administrativo interno (só admin
 * pode) e não interessa a nenhum outro contexto. Publicar por simetria criaria
 * um evento sem consumidor — o mesmo tipo de peso morto que uma coluna sem
 * escritor.
 */
export class ContractAnnulledEvent implements IDomainEvent {
  readonly aggregate_id: ContractId;
  readonly occurred_on: Date;
  readonly event_version: number;

  readonly booking_id: Uuid;
  readonly reason: string;
  readonly annulled_at: Date;

  constructor(props: ContractAnnulledEventProps) {
    this.aggregate_id = props.aggregate_id;
    this.booking_id = props.booking_id;
    this.reason = props.reason;
    this.annulled_at = props.annulled_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
