import { IClock } from "../../../shared/application/clock.interface";
import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { AudienceSpotifyLink } from "../../domain/audience-spotify-link.aggregate";
import { IAudienceSpotifyLinkRepository } from "../../domain/audience-spotify-link.repository";
import { ISpotifyOAuthGateway } from "../../infra/gateways/spotify.gateway";

/**
 * Token de acesso válido do fã, renovando quando necessário.
 *
 * ## Por que um serviço, e não código repetido nos dois use-cases
 *
 * Buscar a faixa e salvá-la precisam da mesma coisa: um `access_token` que o
 * Spotify aceite agora. Ele dura ~1h, então na prática **quase toda** chamada
 * encontra o token vencido — a renovação é o caminho normal, não a exceção.
 * Duplicar isso garantiria que uma das duas cópias esquecesse de persistir o
 * token novo e renovasse a cada requisição.
 *
 * Serviço de aplicação (não de domínio) porque orquestra repositório e gateway;
 * mesmo lugar e mesmo papel de `ReviewEligibilityService`.
 */
export class SpotifyAccessService {
  private readonly clock: IClock;

  constructor(
    private readonly linkRepo: IAudienceSpotifyLinkRepository,
    private readonly oauth: ISpotifyOAuthGateway,
    clock?: IClock,
  ) {
    this.clock = clock ?? { now: () => new Date() };
  }

  /** `null` quando o fã não vinculou a conta — não é erro, é estado. */
  async getLink(audienceId: string): Promise<AudienceSpotifyLink | null> {
    return this.linkRepo.findByAudienceId(audienceId);
  }

  /**
   * Devolve um token utilizável, renovando e persistindo se estiver vencido.
   *
   * ⚠️ **Persiste ANTES de devolver.** Renovar e usar sem gravar faria a
   * próxima chamada renovar de novo — e alguns provedores invalidam o refresh
   * anterior a cada uso, o que transformaria "esqueci de salvar" em vínculo
   * morto.
   */
  async getValidAccessToken(link: AudienceSpotifyLink): Promise<string> {
    if (!link.isExpired(this.clock.now())) {
      return link.access_token;
    }

    const tokens = await this.oauth.refresh(link.refresh_token);

    link.refreshTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
    });

    if (link.notification.hasErrors()) {
      throw new EntityValidationError(link.notification.toJSON());
    }

    await this.linkRepo.update(link);

    return link.access_token;
  }
}
