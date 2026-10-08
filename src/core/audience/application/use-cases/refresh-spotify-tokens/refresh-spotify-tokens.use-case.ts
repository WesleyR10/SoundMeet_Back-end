import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IAudienceSpotifyLinkRepository } from "../../../domain/audience-spotify-link.repository";
import { ISpotifyOAuthGateway } from "../../../infra/gateways/spotify.gateway";

export type RefreshSpotifyTokensInput = {
  limit?: number;
};

export type RefreshSpotifyTokensOutput = {
  examined: number;
  refreshed: number;
  failed: { link_id: string; reason: string }[];
};

export type RefreshSpotifyTokensDeps = {
  linkRepo: IAudienceSpotifyLinkRepository;
  oauth: ISpotifyOAuthGateway;
  clock?: IClock;
  /** Antecedência da renovação. */
  aheadMs?: number;
  batchLimit?: number;
};

/** 10 minutos de folga sobre a hora de validade. */
const DEFAULT_AHEAD_MS = 10 * 60_000;
const DEFAULT_BATCH_LIMIT = 200;

/**
 * Renova em lote os tokens que estão vencendo.
 *
 * ## Por que existe, se o token já é renovado sob demanda
 *
 * `SpotifyAccessService` renova na hora de usar — e isso basta para funcionar.
 * O job existe pelo caso oposto: o fã que **não** usa a feature por semanas.
 * O refresh token do Spotify não expira por tempo, mas pode ser revogado, e um
 * vínculo que só é exercitado no momento em que a pessoa quer salvar uma música
 * falha exatamente ali — no palco, com o show acontecendo. Renovar antes
 * transforma uma falha visível numa falha silenciosa e recuperável.
 *
 * ## Por que nenhuma falha derruba a varredura
 *
 * Um vínculo revogado não pode impedir a renovação dos outros. Cada item é
 * isolado e o motivo volta no output, que é o que o job loga.
 */
export class RefreshSpotifyTokensUseCase implements IUseCase<
  RefreshSpotifyTokensInput,
  RefreshSpotifyTokensOutput
> {
  private readonly clock: IClock;

  constructor(private readonly deps: RefreshSpotifyTokensDeps) {
    this.clock = deps.clock ?? { now: () => new Date() };
  }

  async execute(
    input: RefreshSpotifyTokensInput = {},
  ): Promise<RefreshSpotifyTokensOutput> {
    const ahead = this.deps.aheadMs ?? DEFAULT_AHEAD_MS;
    const limit = input.limit ?? this.deps.batchLimit ?? DEFAULT_BATCH_LIMIT;

    const links = await this.deps.linkRepo.findExpiring(
      new Date(this.clock.now().getTime() + ahead),
      limit,
    );

    const failed: { link_id: string; reason: string }[] = [];
    let refreshed = 0;

    for (const link of links) {
      try {
        const tokens = await this.deps.oauth.refresh(link.refresh_token);

        link.refreshTokens({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_at,
        });

        if (link.notification.hasErrors()) {
          failed.push({
            link_id: link.link_id.id,
            reason: JSON.stringify(link.notification.toJSON()),
          });
          continue;
        }

        await this.deps.linkRepo.update(link);
        refreshed += 1;
      } catch (error) {
        failed.push({
          link_id: link.link_id.id,
          reason: error instanceof Error ? error.message : "erro desconhecido",
        });
      }
    }

    return { examined: links.length, refreshed, failed };
  }
}
