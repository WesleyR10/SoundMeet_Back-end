import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IAudienceSpotifyLinkRepository } from "../../../domain/audience-spotify-link.repository";

export type GetSpotifyLinkStatusInput = {
  audience_id: string;
};

export type GetSpotifyLinkStatusOutput = {
  linked: boolean;
  /** Conta autorizada — só o id público do provedor, para o fã reconhecê-la. */
  spotify_user_id: string | null;
  linked_at: Date | null;
};

/**
 * O fã tem conta Spotify vinculada?
 *
 * 🔴 **Não devolve token nenhum**, nem vencimento. A UI precisa decidir entre
 * "Conectar" e "Salvar no Spotify" — nada mais. Expor `expires_at` convidaria o
 * cliente a implementar a própria lógica de renovação, que é responsabilidade
 * do servidor e depende do refresh token, que o cliente nunca vê.
 */
export class GetSpotifyLinkStatusUseCase implements IUseCase<
  GetSpotifyLinkStatusInput,
  GetSpotifyLinkStatusOutput
> {
  constructor(private readonly linkRepo: IAudienceSpotifyLinkRepository) {}

  async execute(
    input: GetSpotifyLinkStatusInput,
  ): Promise<GetSpotifyLinkStatusOutput> {
    const link = await this.linkRepo.findByAudienceId(input.audience_id);

    if (!link) {
      return { linked: false, spotify_user_id: null, linked_at: null };
    }

    return {
      linked: true,
      spotify_user_id: link.spotify_user_id,
      linked_at: link.created_at,
    };
  }
}
