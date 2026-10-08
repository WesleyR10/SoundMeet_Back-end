import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { ISpotifyLibraryGateway } from "../../../infra/gateways/spotify.gateway";
import { SpotifyAccessService } from "../../services/spotify-access.service";

export type SaveTrackToSpotifyInput = {
  audience_id: string;
  /** Id da faixa CONFIRMADA pelo fã, vindo de `FindSpotifyTrackUseCase`. */
  track_id: string;
};

export type SaveTrackToSpotifyOutput =
  | { linked: false }
  | { linked: true; saved: true };

/**
 * Salva a faixa na biblioteca do fã — o passo que exige o consentimento dele.
 *
 * ⚠️ **Recebe `track_id`, nunca título+artista.** Quem resolve a ambiguidade é
 * `FindSpotifyTrackUseCase`, e o fã confirma o resultado; aceitar texto livre
 * aqui recriaria a adivinhação no exato ponto em que ela vira escrita na conta
 * de outra pessoa.
 *
 * O provedor trata `PUT /v1/me/tracks` como idempotente: salvar de novo o que
 * já está salvo não duplica nem falha, então um toque repetido é inofensivo.
 */
export class SaveTrackToSpotifyUseCase implements IUseCase<
  SaveTrackToSpotifyInput,
  SaveTrackToSpotifyOutput
> {
  constructor(
    private readonly access: SpotifyAccessService,
    private readonly library: ISpotifyLibraryGateway,
  ) {}

  async execute(
    input: SaveTrackToSpotifyInput,
  ): Promise<SaveTrackToSpotifyOutput> {
    if (!input.track_id?.trim()) {
      throw new InvalidArgumentError("track_id é obrigatório");
    }

    const link = await this.access.getLink(input.audience_id);
    if (!link) return { linked: false };

    const accessToken = await this.access.getValidAccessToken(link);

    await this.library.saveTrack(input.track_id.trim(), accessToken);

    return { linked: true, saved: true };
  }
}
