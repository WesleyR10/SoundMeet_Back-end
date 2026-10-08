import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { PerformanceId } from "../performance.aggregate";

export type SongStartedEventProps = {
  performance_id: PerformanceId;
  event_id: string;
  establishment_id: string;
  musician_id: string;
  band_id: string | null;
  performed_song_id: string;
  music_library_id: string | null;
  request_id: string | null;
  title: string;
  artist: string;
  position: number;
  started_at: Date;
};

/**
 * Disparado quando o músico começa uma música com o set aberto.
 *
 * É o gatilho de "tocando agora" para o fã. Carrega `title`/`artist` já
 * resolvidos porque o consumidor não deve precisar voltar à biblioteca para
 * saber o que anunciar — e porque o par pode nem existir lá.
 */
export class SongStartedEvent implements IDomainEvent {
  readonly event_version: number;
  readonly occurred_on: Date;
  readonly aggregate_id: PerformanceId;
  readonly performance_id: PerformanceId;
  readonly event_id: string;
  readonly establishment_id: string;
  readonly musician_id: string;
  readonly band_id: string | null;
  readonly performed_song_id: string;
  readonly music_library_id: string | null;
  readonly request_id: string | null;
  readonly title: string;
  readonly artist: string;
  readonly position: number;
  readonly started_at: Date;

  constructor(props: SongStartedEventProps) {
    this.aggregate_id = props.performance_id;
    this.performance_id = props.performance_id;
    this.event_id = props.event_id;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.performed_song_id = props.performed_song_id;
    this.music_library_id = props.music_library_id;
    this.request_id = props.request_id;
    this.title = props.title;
    this.artist = props.artist;
    this.position = props.position;
    this.started_at = props.started_at;
    this.occurred_on = new Date();
    this.event_version = 1;
  }
}
