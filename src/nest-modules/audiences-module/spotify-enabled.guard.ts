import {
  CanActivate,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";

/**
 * Barra as rotas do Spotify quando a ponte não está configurada.
 *
 * O provider `"SpotifyGateway"` devolve `null` sem `SPOTIFY_CLIENT_ID`,
 * `SECRET` ou `REDIRECT_URI` — em dev, em CI e em qualquer ambiente que não use
 * a feature. Sem este guarda, a chamada morreria dentro do use-case com um
 * `TypeError` sobre propriedade de `null`: 500, log inútil e nenhuma pista de
 * que a causa é configuração ausente.
 *
 * **503, não 404:** a rota existe e voltará a funcionar assim que as
 * credenciais forem configuradas — dizer "não encontrado" mandaria o cliente
 * procurar erro de caminho.
 *
 * Guarda de classe: todas as rotas do controller dependem do gateway, então
 * repetir a checagem em cada uma só criaria a chance de esquecer numa.
 */
@Injectable()
export class SpotifyEnabledGuard implements CanActivate {
  constructor(@Inject("SpotifyGateway") private readonly gateway: unknown) {}

  canActivate(): boolean {
    if (!this.gateway) {
      throw new ServiceUnavailableException(
        "Integração com o Spotify indisponível no momento.",
      );
    }
    return true;
  }
}
