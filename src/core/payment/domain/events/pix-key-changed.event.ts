import { IDomainEvent, Uuid } from "../../../shared/domain";

/**
 * A chave PIX de recebimento do músico foi alterada.
 *
 * Existe para uma coisa só: disparar a notificação antifraude ("sua chave PIX
 * foi alterada — se não foi você…"). É a outra metade da defesa da carência de
 * saque (A1 camada 2): a carência dá tempo, esta notificação usa esse tempo
 * para alertar o dono. Só é emitido quando a chave de fato MUDA — regravar a
 * mesma chave não avisa nada.
 *
 * Sem integration event: é evento interno de notificação, não cruza a fronteira
 * do broker.
 */
export class PixKeyChangedEvent implements IDomainEvent {
  occurred_on: Date;
  event_version = 1;

  constructor(
    public aggregate_id: Uuid,
    public musician_id: Uuid,
  ) {
    this.occurred_on = new Date();
  }

  toJSON() {
    return {
      aggregate_id: this.aggregate_id.id,
      musician_id: this.musician_id.id,
      event_version: this.event_version,
      occurred_on: this.occurred_on.toISOString(),
    };
  }
}
