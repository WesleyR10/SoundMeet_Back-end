import { FollowNotificationKind } from "../follow-types";

/**
 * Ledger de entrega: quem já foi avisado de quê, por evento.
 *
 * `claim` reserva o envio ANTES de enviar e devolve só os ids que entraram
 * agora — quem já estava no ledger (seguiu o músico E a casa, ou o handler
 * reentrou) fica de fora. A garantia é a unique `(audience, kind, event)` no
 * banco; a ordem reservar → enviar aceita perder um push numa queda entre os
 * dois passos, e nunca mandar o mesmo push duas vezes.
 */
export interface IFollowNotificationLedger {
  claim(params: {
    kind: FollowNotificationKind;
    event_id: string;
    audience_ids: string[];
    at: Date;
  }): Promise<string[]>;

  /** Quem recebeu algum destes avisos sobre o evento (para avisar o cancelamento). */
  findNotifiedAudienceIds(params: {
    event_id: string;
    kinds: FollowNotificationKind[];
  }): Promise<string[]>;
}

/**
 * Token de push dos fãs. Porta porque o token mora em `Audience`, que o
 * domínio `follow` não carrega inteiro só para isto. Quem não tem token não
 * volta na lista.
 */
export interface IAudiencePushTokenPort {
  findPushTokens(
    audience_ids: string[],
  ): Promise<Array<{ audience_id: string; push_token: string }>>;
}

export type FollowPushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

export interface IFollowPushSender {
  sendMany(messages: FollowPushMessage[]): Promise<void>;
}
