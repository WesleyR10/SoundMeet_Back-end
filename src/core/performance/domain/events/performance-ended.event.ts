import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { PerformanceId } from "../performance.aggregate";

export type PerformanceEndedEventProps = {
  performance_id: PerformanceId;
  event_id: string;
  establishment_id: string;
  musician_id: string;
  band_id: string | null;
  songs_count: number;
  started_at: Date;
  ended_at: Date;
};

/**
 * Set encerrado. É o gatilho do relatório pós-show (F6) — que só existe para
 * set fechado, porque relatório de show em andamento é um número que muda
 * enquanto se olha, e o músico o leria no palco.
 */
export class PerformanceEndedEvent implements IDomainEvent {
  readonly event_version: number;
  readonly occurred_on: Date;
  readonly aggregate_id: PerformanceId;
  readonly performance_id: PerformanceId;
  readonly event_id: string;
  readonly establishment_id: string;
  readonly musician_id: string;
  readonly band_id: string | null;
  readonly songs_count: number;
  readonly started_at: Date;
  readonly ended_at: Date;

  constructor(props: PerformanceEndedEventProps) {
    this.aggregate_id = props.performance_id;
    this.performance_id = props.performance_id;
    this.event_id = props.event_id;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.songs_count = props.songs_count;
    this.started_at = props.started_at;
    this.ended_at = props.ended_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
