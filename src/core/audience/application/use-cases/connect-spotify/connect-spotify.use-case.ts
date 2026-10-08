import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ISpotifyOAuthGateway } from "../../../infra/gateways/spotify.gateway";

export type ConnectSpotifyInput = {
  audience_id: string;
};

export type ConnectSpotifyOutput = {
  authorization_url: string;
};

/** Assina o `state` que amarra a autorização a ESTE fã. */
export interface IOAuthStateSigner {
  sign(subject_id: string): string;
}

/**
 * Passo 1 do vínculo: devolve a URL de consentimento do Spotify.
 *
 * Quem abre a URL é o app, num navegador — e o callback volta **sem** token de
 * autenticação, porque quem redireciona é o provedor. Por isso o `audience_id`
 * viaja assinado dentro do `state`: é a única coisa que impede alguém de montar
 * um `state` apontando para outra pessoa e vincular a própria conta Spotify à
 * conta dela.
 */
export class ConnectSpotifyUseCase implements IUseCase<
  ConnectSpotifyInput,
  ConnectSpotifyOutput
> {
  constructor(
    private readonly oauth: ISpotifyOAuthGateway,
    private readonly state: IOAuthStateSigner,
  ) {}

  async execute(input: ConnectSpotifyInput): Promise<ConnectSpotifyOutput> {
    return {
      authorization_url: this.oauth.buildAuthorizationUrl(
        this.state.sign(input.audience_id),
      ),
    };
  }
}
