import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ISpotifyLibraryGateway } from "../../../infra/gateways/spotify.gateway";
import { SpotifyAccessService } from "../../services/spotify-access.service";

export type FindSpotifyTrackInput = {
  audience_id: string;
  title: string;
  artist: string;
};

export type FindSpotifyTrackOutput =
  | { linked: false }
  | { linked: true; found: false }
  | {
      linked: true;
      found: true;
      track: {
        id: string;
        title: string;
        artist: string;
        album: string | null;
        artwork_url: string | null;
        preview_url: string | null;
      };
    };

/**
 * Procura no Spotify a música que o fã acabou de ouvir ao vivo.
 *
 * ## Por que isto NÃO salva
 *
 * Casar título+artista com o catálogo é ambíguo por natureza: cover, ao vivo,
 * remaster, tributo e homônimo competem pelo mesmo texto. Salvar direto
 * acertaria na maioria das vezes e, na minoria, poria silenciosamente uma faixa
 * errada na biblioteca de alguém — um erro que a pessoa só descobre depois e
 * que corrói a confiança na feature inteira. Mostrar o candidato (com capa e
 * álbum) e pedir um toque de confirmação custa um segundo e elimina a classe
 * inteira de erro.
 *
 * ## Três respostas, não uma exceção
 *
 * "Não vinculado" e "não encontrado" são **estados**, não falhas: a UI mostra
 * caminhos diferentes para cada um (conectar a conta vs. avisar que a faixa não
 * está no catálogo). Lançar exceção obrigaria o cliente a inspecionar mensagem
 * de erro para decidir o que exibir.
 */
export class FindSpotifyTrackUseCase implements IUseCase<
  FindSpotifyTrackInput,
  FindSpotifyTrackOutput
> {
  constructor(
    private readonly access: SpotifyAccessService,
    private readonly library: ISpotifyLibraryGateway,
  ) {}

  async execute(input: FindSpotifyTrackInput): Promise<FindSpotifyTrackOutput> {
    const link = await this.access.getLink(input.audience_id);
    if (!link) return { linked: false };

    const accessToken = await this.access.getValidAccessToken(link);

    const track = await this.library.searchTrack(
      { title: input.title, artist: input.artist },
      accessToken,
    );

    if (!track) return { linked: true, found: false };

    return { linked: true, found: true, track };
  }
}
