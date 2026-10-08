import { IDomainEvent } from "../../../shared/domain/events/domain-event.interface";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { SocialShareContentType } from "../value-objects/social-share-content";

/**
 * ⚠️ `event_version: 2` — o payload trocou `request_id` por
 * `content_type` + `content_id` (28/set/2026), para que o crédito de pontos
 * possa ser deduplicado por PEÇA de conteúdo. Nada consumia este evento
 * (`grep` não achava um único handler), então não há mensagem antiga em trânsito
 * a suportar; a versão sobe mesmo assim, porque é ela que conta a história para
 * quem ler um payload persistido.
 */
export class SocialMediaSharedEvent implements IDomainEvent {
  occurred_on: Date;
  event_version: number = 2;

  constructor(
    public aggregate_id: Uuid,
    public content_type: SocialShareContentType,
    public content_id: string,
    /** `null` quando o destino é desconhecido — ver `ShareSocialMediaInput`. */
    public platform: string | null,
    public message?: string,
  ) {
    this.occurred_on = new Date();
  }

  toJSON() {
    return {
      aggregate_id: this.aggregate_id.id,
      content_type: this.content_type,
      content_id: this.content_id,
      platform: this.platform,
      message: this.message,
      event_version: this.event_version,
      occurred_on: this.occurred_on.toISOString(),
    };
  }

  static fromJSON(data: any): SocialMediaSharedEvent {
    const event = new SocialMediaSharedEvent(
      new Uuid(data.aggregate_id),
      data.content_type,
      data.content_id,
      data.platform,
      data.message,
    );
    event.occurred_on = new Date(data.occurred_on);
    event.event_version = data.event_version;
    return event;
  }
}
