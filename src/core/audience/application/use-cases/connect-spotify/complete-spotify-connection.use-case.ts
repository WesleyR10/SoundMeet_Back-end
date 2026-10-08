import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { AudienceSpotifyLink } from "../../../domain/audience-spotify-link.aggregate";
import { IAudienceSpotifyLinkRepository } from "../../../domain/audience-spotify-link.repository";
import { ISpotifyOAuthGateway } from "../../../infra/gateways/spotify.gateway";

export type CompleteSpotifyConnectionInput = {
  /** `code` devolvido pelo provedor no callback. */
  code: string;
  /** `state` assinado — é ele que diz de quem é a conta. */
  state: string;
};

export type CompleteSpotifyConnectionOutput = {
  audience_id: string;
  spotify_user_id: string;
  expires_at: Date;
};

/** Verifica o `state` assinado. `musician_id` é o nome do campo genérico. */
export interface IOAuthStateVerifier {
  verify(state: string): { musician_id: string };
}

/**
 * Passo 2 do vínculo: troca o `code` pelos tokens e liga à conta do fã.
 *
 * ## A ordem importa
 *
 * 1. **Verificar o `state` PRIMEIRO.** Ele diz de quem é a conta e chega por um
 *    redirect sem autenticação; trocar o código antes gastaria o `code` de um
 *    fluxo que pode nem ser legítimo.
 * 2. Só então trocar o `code` pelos tokens.
 * 3. Persistir — o mapper cifra na borda.
 *
 * Reautorizar é permitido e substitui o par de tokens (ver
 * `AudienceSpotifyLink.relink`): não há segredo insubstituível aqui, ao
 * contrário da chave da subconta Asaas.
 */
export class CompleteSpotifyConnectionUseCase implements IUseCase<
  CompleteSpotifyConnectionInput,
  CompleteSpotifyConnectionOutput
> {
  constructor(
    private readonly linkRepo: IAudienceSpotifyLinkRepository,
    private readonly oauth: ISpotifyOAuthGateway,
    private readonly state: IOAuthStateVerifier,
  ) {}

  async execute(
    input: CompleteSpotifyConnectionInput,
  ): Promise<CompleteSpotifyConnectionOutput> {
    // O verificador é genérico; o campo se chama `musician_id`, mas carrega o
    // sujeito assinado — aqui, o fã.
    const { musician_id: audience_id } = this.state.verify(input.state);

    const tokens = await this.oauth.exchangeCode(input.code);

    /*
     * `exchangeCode` já falha alto quando o provedor não devolve refresh, mas o
     * tipo é `string | null` por causa da RENOVAÇÃO — onde a ausência é normal.
     * Este guarda é o que impede o tipo mais permissivo de virar um vínculo sem
     * refresh caso um adapter futuro relaxe a checagem.
     */
    if (!tokens.refresh_token) {
      throw new EntityValidationError([
        { refresh_token: ["Spotify não devolveu refresh_token"] },
      ]);
    }

    const existing = await this.linkRepo.findByAudienceId(audience_id);

    if (existing) {
      existing.relink({
        spotify_user_id: tokens.spotify_user_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at,
      });

      if (existing.notification.hasErrors()) {
        throw new EntityValidationError(existing.notification.toJSON());
      }

      await this.linkRepo.update(existing);
    } else {
      const link = AudienceSpotifyLink.create({
        audience_id,
        spotify_user_id: tokens.spotify_user_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at,
      });

      if (link.notification.hasErrors()) {
        throw new EntityValidationError(link.notification.toJSON());
      }

      await this.linkRepo.insert(link);
    }

    return {
      audience_id,
      spotify_user_id: tokens.spotify_user_id,
      expires_at: tokens.expires_at,
    };
  }
}
