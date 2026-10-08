import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  MusicLibrary,
  MusicLibraryId,
} from "../../../domain/music-library.aggregate";
import { IMusicLibraryRepository } from "../../../domain/music-library.repository";
import { ISpotifyCatalogGateway } from "../../ports/spotify-catalog.interface";
import { SpotifyTrackMatcher } from "../../services/spotify-track-matcher";

/**
 * Quanto tempo um "não achei" vale antes de tentar de novo.
 *
 * 30 dias porque catálogo muda devagar: música que não estava no Spotify hoje
 * raramente aparece amanhã, e reconsultar toda semana gastaria quota para
 * confirmar a mesma ausência.
 */
const NEGATIVE_CACHE_DAYS = 30;

export type ResolveSpotifyTrackInput = {
  music_library_id: string;
  /** Refaz a busca mesmo com resultado em cache — usado pela correção manual. */
  force?: boolean;
};

export type ResolveSpotifyTrackOutput = {
  music_library_id: string;
  resolved: boolean;
  spotify_track_id: string | null;
  score: number | null;
  duration_diff_seconds: number | null;
  /** `true` quando nada foi consultado por já haver resposta válida. */
  from_cache: boolean;
};

/**
 * Descobre qual faixa do Spotify corresponde a uma música da biblioteca.
 *
 * ## Quando roda
 *
 * Na **materialização da análise**, junto do casamento da LRC — não na hora do
 * show. Os dois usam o mesmo sinal (duração) e o mesmo momento é o certo:
 * resolver sob demanda cobraria latência no palco e multiplicaria a chamada ao
 * Spotify pelo número de fãs presentes, que compartilham o mesmo rate limit.
 *
 * ## Nunca lança por falha do provedor
 *
 * O Spotify fora do ar não pode derrubar a materialização de uma cifra: a cifra
 * é o produto, o link é conveniência. Falha de rede devolve `resolved: false`
 * **sem** gravar `checked_at` — assim o job tenta de novo, enquanto um "não
 * existe no catálogo" (busca que respondeu vazio) fica gravado como negative
 * cache.
 */
export class ResolveSpotifyTrackUseCase implements IUseCase<
  ResolveSpotifyTrackInput,
  ResolveSpotifyTrackOutput
> {
  constructor(
    private readonly repo: IMusicLibraryRepository,
    private readonly catalog: ISpotifyCatalogGateway,
    private readonly matcher: SpotifyTrackMatcher = new SpotifyTrackMatcher(),
  ) {}

  async execute(
    input: ResolveSpotifyTrackInput,
  ): Promise<ResolveSpotifyTrackOutput> {
    const song = await this.repo.findById(
      new MusicLibraryId(input.music_library_id),
    );

    if (!song) {
      return this.empty(input.music_library_id, false);
    }

    if (!input.force && this.hasFreshAnswer(song)) {
      return {
        music_library_id: song.music_library_id.id,
        resolved: song.spotify_track_id !== null,
        spotify_track_id: song.spotify_track_id,
        score: song.spotify_match_score,
        duration_diff_seconds: null,
        from_cache: true,
      };
    }

    let candidates;
    try {
      candidates = await this.catalog.searchTracks({
        title: song.title,
        artist: song.artist,
      });
    } catch {
      // Provedor indisponível não é "não existe". Sem gravar `checked_at`, a
      // próxima passada do job tenta de novo.
      return this.empty(song.music_library_id.id, false);
    }

    const match = this.matcher.pickBest(
      {
        title: song.title,
        artist: song.artist,
        duration_seconds: song.duration_seconds,
      },
      candidates,
    );

    song.registerSpotifyMatch({
      track_id: match?.track.id ?? null,
      score: match?.score ?? null,
    });

    await this.repo.update(song);

    return {
      music_library_id: song.music_library_id.id,
      resolved: match !== null,
      spotify_track_id: match?.track.id ?? null,
      score: match?.score ?? null,
      duration_diff_seconds: match?.duration_diff_seconds ?? null,
      from_cache: false,
    };
  }

  private hasFreshAnswer(song: MusicLibrary): boolean {
    if (!song.spotify_checked_at) return false;
    // Casamento encontrado não expira: faixa não muda de id no Spotify.
    if (song.spotify_track_id) return true;

    const ageMs = Date.now() - song.spotify_checked_at.getTime();
    return ageMs < NEGATIVE_CACHE_DAYS * 24 * 60 * 60 * 1000;
  }

  private empty(id: string, resolved: boolean): ResolveSpotifyTrackOutput {
    return {
      music_library_id: id,
      resolved,
      spotify_track_id: null,
      score: null,
      duration_diff_seconds: null,
      from_cache: false,
    };
  }
}
