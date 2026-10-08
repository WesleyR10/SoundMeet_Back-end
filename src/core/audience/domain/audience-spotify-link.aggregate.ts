import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { AudienceSpotifyLinkFakeBuilder } from "./audience-spotify-link-fake.builder";
import { AudienceSpotifyLinkValidatorFactory } from "./validators/audience-spotify-link.validator";

export class AudienceSpotifyLinkId extends Uuid {}

export type AudienceSpotifyLinkConstructorProps = {
  link_id?: AudienceSpotifyLinkId;
  audience_id: Uuid;
  spotify_user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  created_at?: Date;
  updated_at?: Date;
};

export type AudienceSpotifyLinkCreateCommand = {
  audience_id: string;
  spotify_user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
};

/**
 * Vínculo da conta Spotify de um fã.
 *
 * ## Por que agregado próprio, e não campos em `Audience`
 *
 * Segue o precedente do `MusicianWallet`: os tokens do Mercado Pago do músico
 * vivem lá, não em `Musician`. Token de terceiro tem ciclo de vida próprio
 * (expira, é renovado, é revogado), é cifrado em repouso e quase nunca é lido
 * junto do perfil — carregá-lo em toda leitura de `Audience` seria pagar por
 * um dado que a maior parte das telas não usa.
 *
 * ## O que este vínculo autoriza, e o que não
 *
 * Escopo `user-library-modify`: salvar música na biblioteca do fã. **Não** lê
 * histórico, não lê playlists, não posta nada. É o mínimo para "gostei ao vivo,
 * salva pra mim" — pedir mais escopo do que a feature usa é o tipo de coisa que
 * derruba a taxa de autorização e não se justifica depois.
 *
 * 🔴 **Os dois tokens são cifrados em repouso** (AES-256-GCM, infra de SM-016)
 * e **nunca saem em `toJSON`**. O `access_token` escreve na conta do fã.
 */
export class AudienceSpotifyLink extends AggregateRoot {
  link_id: AudienceSpotifyLinkId;
  audience_id: Uuid;
  spotify_user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;

  constructor(props: AudienceSpotifyLinkConstructorProps) {
    super();
    this.link_id = props.link_id ?? new AudienceSpotifyLinkId();
    this.audience_id = props.audience_id;
    this.spotify_user_id = props.spotify_user_id;
    this.access_token = props.access_token;
    this.refresh_token = props.refresh_token;
    this.expires_at = props.expires_at;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): AudienceSpotifyLinkId {
    return this.link_id;
  }

  static create(
    command: AudienceSpotifyLinkCreateCommand,
  ): AudienceSpotifyLink {
    const link = new AudienceSpotifyLink({
      audience_id: new Uuid(command.audience_id),
      spotify_user_id: command.spotify_user_id,
      access_token: command.access_token,
      refresh_token: command.refresh_token,
      expires_at: command.expires_at,
    });

    link.validate();
    return link;
  }

  /**
   * Reautorização — o fã passou pelo consentimento de novo.
   *
   * Diferente de `MusicianWallet.linkSubaccount` (que RECUSA sobrescrever, para
   * não perder a chave irrecuperável da subconta), aqui substituir é o
   * comportamento certo: não há segredo insubstituível: se o fã reautoriza, o
   * par novo simplesmente vale mais que o velho. Mesma decisão de
   * `linkMercadoPago`.
   */
  relink(command: {
    spotify_user_id: string;
    access_token: string;
    refresh_token: string;
    expires_at: Date;
  }): void {
    this.spotify_user_id = command.spotify_user_id;
    this.access_token = command.access_token;
    this.refresh_token = command.refresh_token;
    this.expires_at = command.expires_at;
    this.updated_at = new Date();
    this.validate();
  }

  /**
   * Renovação silenciosa pelo job.
   *
   * ⚠️ **O Spotify nem sempre devolve um `refresh_token` novo.** Quando não
   * devolve, o antigo continua válido — sobrescrever com vazio mataria o
   * vínculo, e o sintoma apareceria semanas depois como "parou de salvar".
   */
  refreshTokens(command: {
    access_token: string;
    refresh_token?: string | null;
    expires_at: Date;
  }): void {
    if (!command.access_token?.trim()) {
      this.notification.addError(
        "Renovação exige access_token",
        "access_token",
      );
      return;
    }

    this.access_token = command.access_token;
    if (command.refresh_token?.trim()) {
      this.refresh_token = command.refresh_token;
    }
    this.expires_at = command.expires_at;
    this.updated_at = new Date();
  }

  /**
   * O token de acesso vence em ~1h; renovar com folga evita a corrida entre a
   * checagem e a chamada de fato.
   */
  isExpired(at: Date = new Date(), skewMs = 60_000): boolean {
    return this.expires_at.getTime() - skewMs <= at.getTime();
  }

  validate(fields?: string[]): boolean {
    const validator = AudienceSpotifyLinkValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return AudienceSpotifyLinkFakeBuilder;
  }

  /**
   * 🔴 **Nenhum token sai daqui.** `toJSON` alimenta output de use case, que
   * vira resposta HTTP — e o `access_token` escreve na biblioteca do fã. O que
   * a UI precisa saber é apenas que existe vínculo, e com qual conta.
   */
  toJSON() {
    return {
      link_id: this.link_id.id,
      audience_id: this.audience_id.id,
      spotify_user_id: this.spotify_user_id,
      expires_at: this.expires_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
