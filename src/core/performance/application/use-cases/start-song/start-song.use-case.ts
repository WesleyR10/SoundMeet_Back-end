import { ForbiddenException } from "@nestjs/common";

import {
  MusicLibrary,
  MusicLibraryId,
} from "../../../../music-library/domain/music-library.aggregate";
import { IMusicLibraryRepository } from "../../../../music-library/domain/music-library.repository";
import {
  Request,
  RequestId,
} from "../../../../request/domain/request.aggregate";
import { IRequestRepository } from "../../../../request/domain/request.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  Performance,
  PerformanceId,
} from "../../../domain/performance.aggregate";
import { IPerformanceRepository } from "../../../domain/performance.repository";
import {
  PerformanceOutput,
  PerformanceOutputMapper,
} from "../common/performance-output";

export type StartSongInput = {
  performance_id: string;
  /** Do JWT. Nunca do corpo — é o que prova a posse do set. */
  requesting_musician_id: string;
  /** Música do repertório/biblioteca do músico. */
  music_library_id?: string | null;
  /** Pedido do público que esta execução atende. */
  request_id?: string | null;
  /** Usados quando a música não vem nem da biblioteca nem de um pedido. */
  title?: string | null;
  artist?: string | null;
};

export type StartSongOutput = PerformanceOutput;

/**
 * Registra o início de uma música, fechando a anterior.
 *
 * O título e o artista são resolvidos AQUI e gravados como snapshot no
 * agregado — biblioteca, pedido ou texto livre, nesta ordem de precedência.
 * Depois deste ponto ninguém volta à origem: o que ficou registrado é o que foi
 * anunciado no palco, e é o que o fã manda para o Spotify.
 *
 * Marcar o pedido como tocado **não acontece aqui**. Sai por handler do
 * `SongStartedEvent`, como todo efeito cross-context neste projeto: o
 * `RequestPrismaRepository` não participa de UnitOfWork, então uma escrita
 * inline nos dois agregados não seria atômica de qualquer forma — e falhar o
 * registro da música porque um status secundário não gravou seria o pior
 * resultado possível para quem está no palco.
 */
export class StartSongUseCase implements IUseCase<
  StartSongInput,
  StartSongOutput
> {
  constructor(
    private readonly performanceRepo: IPerformanceRepository,
    private readonly musicLibraryRepo: IMusicLibraryRepository,
    private readonly requestRepo: IRequestRepository,
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: StartSongInput): Promise<StartSongOutput> {
    const performance = await this.loadOwnedPerformance(
      input.performance_id,
      input.requesting_musician_id,
    );

    const { title, artist, spotify_track_id } = await this.resolveSong(
      input,
      performance,
    );

    performance.startSong({
      title,
      artist,
      spotify_track_id,
      music_library_id: input.music_library_id ?? null,
      request_id: input.request_id ?? null,
    });

    if (performance.notification.hasErrors()) {
      throw new EntityValidationError(performance.notification.toJSON());
    }

    await this.performanceRepo.update(performance);
    await this.domainEventMediator?.publish(performance);

    return PerformanceOutputMapper.toOutput(performance);
  }

  /**
   * A posse do set NÃO vem da URL.
   *
   * `MusicianOwnershipGuard` resolve o dono por `["musician_id","musicianId",
   * "id"]` do path; num sub-recurso identificado por `:performance_id` não há o
   * que resolver, e um `:id` genérico colidiria e autorizaria errado. Carregar
   * e comparar com o `sub` do token é o padrão mais robusto já usado em
   * `ai-audio` — evita a classe de bug em vez de desviar dela.
   */
  private async loadOwnedPerformance(
    performance_id: string,
    requesting_musician_id: string,
  ): Promise<Performance> {
    const performance = await this.performanceRepo.findById(
      new PerformanceId(performance_id),
    );

    if (!performance) {
      throw new NotFoundError(performance_id, Performance);
    }

    if (!performance.isOwnedBy(requesting_musician_id)) {
      throw new ForbiddenException("Este set não é seu.");
    }

    return performance;
  }

  private async resolveSong(
    input: StartSongInput,
    performance: Performance,
  ): Promise<{
    title: string;
    artist: string;
    spotify_track_id: string | null;
  }> {
    if (input.music_library_id) {
      const song = await this.musicLibraryRepo.findById(
        new MusicLibraryId(input.music_library_id),
      );

      if (!song) {
        throw new NotFoundError(input.music_library_id, MusicLibrary);
      }

      // A biblioteca é por músico. Sem esta checagem, o set citaria a entrada
      // de outra pessoa — e o F5 passaria a cruzar repertório alheio.
      if (song.musician_id.id !== performance.musician_id.id) {
        throw new ForbiddenException(
          "Esta música não pertence à sua biblioteca.",
        );
      }

      // O casamento com o Spotify já foi feito na materialização da análise,
      // com a duração da gravação que o músico analisou. Copiar aqui é o que
      // permite ao fã abrir a faixa CERTA sem nenhuma busca no caminho quente.
      return {
        title: song.title,
        artist: song.artist,
        spotify_track_id: song.spotify_track_id,
      };
    }

    if (input.request_id) {
      const request = await this.requestRepo.findById(
        new RequestId(input.request_id),
      );

      if (!request) {
        throw new NotFoundError(input.request_id, Request);
      }

      // O pedido tem que ser DESTE músico e DESTE evento. Sem os dois, o
      // endpoint marcaria como tocado o pedido de um show alheio — e daria ao
      // fã de outro evento os pontos de bônus de `RequestPlayedEvent`.
      if (request.musician_id.id !== performance.musician_id.id) {
        throw new ForbiddenException("Este pedido não é seu.");
      }

      if (request.event_id.id !== performance.event_id.id) {
        throw new ForbiddenException("Este pedido é de outro evento.");
      }

      return {
        // Pedido não passou pelo pipeline: não há duração analisada, e
        // adivinhar a faixa só com texto é o erro que a duração existe para
        // evitar. Sem link é melhor que com o link errado.
        spotify_track_id: null,
        title: request.song_title.value,
        // Pedido pode não trazer artista; o snapshot não aceita vazio, então
        // cai num rótulo explícito em vez de string em branco — que viraria
        // busca inútil no Spotify e linha suja no relatório.
        artist: request.artist?.trim() || "Artista não informado",
      };
    }

    return {
      title: (input.title ?? "").trim(),
      artist: (input.artist ?? "").trim(),
      spotify_track_id: null,
    };
  }
}
