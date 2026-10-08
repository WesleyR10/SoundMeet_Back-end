import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";

export class MusicianIndicatedEvent implements IDomainEvent {
  occurred_on: Date;
  event_version: number = 1;

  constructor(
    public aggregate_id: Uuid,
    public establishment_id: string,
    public musician_id: string,
    /**
     * Por que o fã indica. Viajava no input do use-case e era DESCARTADO aqui
     * (28/set/2026) — sem ele a caixa de entrada do estabelecimento mostraria
     * "alguém indicou fulano" sem o motivo, que é a parte útil da indicação.
     */
    public message?: string | null,
  ) {
    this.occurred_on = new Date();
  }

  toJSON() {
    return {
      aggregate_id: this.aggregate_id.id,
      establishment_id: this.establishment_id,
      musician_id: this.musician_id,
      message: this.message,
      event_version: this.event_version,
      occurred_on: this.occurred_on.toISOString(),
    };
  }

  static fromJSON(data: any): MusicianIndicatedEvent {
    const event = new MusicianIndicatedEvent(
      new Uuid(data.aggregate_id),
      data.establishment_id,
      data.musician_id,
      data.message,
    );
    event.occurred_on = new Date(data.occurred_on);
    event.event_version = data.event_version;
    return event;
  }
}
