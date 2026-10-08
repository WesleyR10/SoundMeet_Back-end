import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { PerformanceId } from "../performance.aggregate";

export type PerformanceStartedEventProps = {
  performance_id: PerformanceId;
  event_id: string;
  establishment_id: string;
  musician_id: string;
  band_id: string | null;
  started_at: Date;
};

/**
 * O músico abriu o set — a música começou de verdade naquele palco.
 *
 * É o gatilho de "começou agora" para quem segue o músico ou a casa (Bloco
 * 19.B). Sai do set, e não da ativação do evento, porque o evento ativo diz
 * que a casa abriu; o set aberto diz que tem música tocando.
 *
 * Só no `create`: reabrir o mesmo set (idempotência do `StartPerformance`)
 * devolve o existente e não emite de novo.
 */
export class PerformanceStartedEvent implements IDomainEvent {
  readonly event_version: number;
  readonly occurred_on: Date;
  readonly aggregate_id: PerformanceId;
  readonly event_id: string;
  readonly establishment_id: string;
  readonly musician_id: string;
  readonly band_id: string | null;
  readonly started_at: Date;

  constructor(props: PerformanceStartedEventProps) {
    this.aggregate_id = props.performance_id;
    this.event_id = props.event_id;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.started_at = props.started_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
