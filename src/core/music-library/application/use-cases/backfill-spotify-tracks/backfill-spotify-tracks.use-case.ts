import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IMusicLibraryRepository } from "../../../domain/music-library.repository";
import { ResolveSpotifyTrackUseCase } from "../resolve-spotify-track/resolve-spotify-track.use-case";

/**
 * Quantas músicas por passada.
 *
 * Pequeno de propósito: o rate limit do Spotify é por aplicação e **é o mesmo
 * que atende o caminho quente** (a materialização de uma análise recém-feita).
 * Um lote grande gastaria a janela para varrer acervo antigo e faria a música
 * que o músico acabou de cadastrar esperar.
 */
const BATCH_SIZE = 25;

/** Respiro entre chamadas, pelo mesmo motivo. */
const DELAY_BETWEEN_MS = 250;

export type BackfillSpotifyTracksInput = {
  limit?: number;
};

export type BackfillSpotifyTracksOutput = {
  examined: number;
  resolved: number;
  not_found: number;
};

/**
 * Resolve a faixa do Spotify das músicas que entraram na biblioteca **antes**
 * desta feature existir.
 *
 * ## Por que job, e não resolução preguiçosa na leitura
 *
 * Resolver na primeira leitura colocaria uma chamada ao Spotify no caminho do
 * Play Mode — no palco, com a rede do bar. O job paga esse custo antes, num
 * momento em que ninguém está esperando.
 *
 * ## Sequencial, não `Promise.all`
 *
 * Disparar 25 buscas em paralelo é a forma mais rápida de tomar 429 e ter as 25
 * falhando juntas. O ganho de paralelizar um backfill que não tem prazo é zero.
 */
export class BackfillSpotifyTracksUseCase implements IUseCase<
  BackfillSpotifyTracksInput,
  BackfillSpotifyTracksOutput
> {
  constructor(
    private readonly repo: IMusicLibraryRepository,
    private readonly resolveUseCase: ResolveSpotifyTrackUseCase,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async execute(
    input: BackfillSpotifyTracksInput = {},
  ): Promise<BackfillSpotifyTracksOutput> {
    const limit = input.limit ?? BATCH_SIZE;
    const pending = await this.repo.findPendingSpotifyResolution(limit);

    let resolved = 0;
    let notFound = 0;

    for (const song of pending) {
      const output = await this.resolveUseCase.execute({
        music_library_id: song.music_library_id.id,
      });

      if (output.resolved) resolved += 1;
      else notFound += 1;

      if (DELAY_BETWEEN_MS > 0) await this.sleep(DELAY_BETWEEN_MS);
    }

    return { examined: pending.length, resolved, not_found: notFound };
  }
}
