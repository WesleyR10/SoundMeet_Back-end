import {
  InvalidOAuthStateError,
  OAuthStateService,
} from "../../core/shared/infra/crypto/oauth-state.service";

export { InvalidOAuthStateError };

const STATE_PURPOSE = "gcal_connect" as const;

/**
 * `state` do OAuth do Google Calendar.
 *
 * A implementação mora em `OAuthStateService` (shared) desde 19/ago/2026, quando
 * o vínculo com o Mercado Pago passou a precisar do mesmo mecanismo. Duas cópias
 * de uma verificação de assinatura divergiriam na primeira correção que só uma
 * recebesse — e aqui a assinatura é a ÚNICA coisa que impede alguém de vincular
 * a conta dele ao músico de outra pessoa.
 *
 * O `purpose` é o que impede um `state` emitido aqui de ser aceito no callback
 * do gateway de pagamento, e vice-versa.
 */
export class GoogleCalendarOAuthStateService extends OAuthStateService {
  constructor(secret: string) {
    super(secret, STATE_PURPOSE);
  }
}
