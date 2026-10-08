import { randomUUID } from "crypto";

import { AggregateRoot, Uuid } from "../../shared/domain";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { PerformanceEndedEvent } from "./events/performance-ended.event";
import { PerformanceStartedEvent } from "./events/performance-started.event";
import { SongStartedEvent } from "./events/song-started.event";
import { PerformanceValidatorFactory } from "./performance.validator";
import { PerformanceFakeBuilder } from "./performance-fake.builder";
import { PerformanceStatus } from "./value-objects/performance-status.vo";

// ─── Entidade embutida ───────────────────────────────────────────────────────

export type PerformedSongProps = {
  performed_song_id: string;
  music_library_id?: string | null;
  request_id?: string | null;
  title: string;
  artist: string;
  spotify_track_id?: string | null;
  position: number;
  started_at?: Date;
  ended_at?: Date | null;
};

/**
 * Uma música executada dentro de um set — mesmo padrão de `RepertoireSong`.
 *
 * 🔴 `title`/`artist` são SNAPSHOT, não referência à biblioteca. Renomear a
 * música em `music_library` seis meses depois não pode reescrever o histórico
 * do show; e é este par que o fã manda para a busca do Spotify, então precisa
 * ser o que foi anunciado no palco, não o que a biblioteca diz hoje.
 */
export class PerformedSong {
  readonly performed_song_id: string;
  readonly music_library_id: string | null;
  readonly request_id: string | null;
  readonly title: string;
  readonly artist: string;
  /**
   * Faixa no Spotify, copiada de `music_library` no instante da execução.
   *
   * Snapshot pelo mesmo motivo de `title`/`artist` — e por um segundo: a
   * leitura do fã é polling de 20s, então resolver por join a cada consulta
   * multiplicaria a carga pelo número de pessoas na casa, para um dado que não
   * muda durante a música.
   */
  readonly spotify_track_id: string | null;
  readonly position: number;
  readonly started_at: Date;
  ended_at: Date | null;

  constructor(props: PerformedSongProps) {
    this.performed_song_id = props.performed_song_id;
    this.music_library_id = props.music_library_id ?? null;
    this.request_id = props.request_id ?? null;
    this.title = props.title;
    this.artist = props.artist;
    this.spotify_track_id = props.spotify_track_id ?? null;
    this.position = props.position;
    this.started_at = props.started_at ?? new Date();
    this.ended_at = props.ended_at ?? null;
  }

  /** `position` é omitida de propósito: quem atribui é o agregado. */
  static create(
    props: Omit<PerformedSongProps, "performed_song_id" | "position"> & {
      position?: number;
    },
  ): PerformedSong {
    return new PerformedSong({
      ...props,
      performed_song_id: randomUUID(),
      position: props.position ?? 0,
    });
  }

  get is_playing(): boolean {
    return this.ended_at === null;
  }

  /**
   * Duração em segundos, ou `null` quando a música nunca foi fechada.
   *
   * `null` é resposta legítima e é o que o relatório exibe: se o músico
   * esqueceu o app aberto, inventar uma duração seria pior que admitir que não
   * se sabe.
   */
  get duration_seconds(): number | null {
    if (!this.ended_at) return null;
    return Math.max(
      0,
      Math.round((this.ended_at.getTime() - this.started_at.getTime()) / 1000),
    );
  }

  toJSON() {
    return {
      performed_song_id: this.performed_song_id,
      music_library_id: this.music_library_id,
      request_id: this.request_id,
      title: this.title,
      artist: this.artist,
      spotify_track_id: this.spotify_track_id,
      position: this.position,
      started_at: this.started_at,
      ended_at: this.ended_at,
      duration_seconds: this.duration_seconds,
    };
  }
}

// ─── Raiz de agregado ────────────────────────────────────────────────────────

export class PerformanceId extends Uuid {}

export type PerformanceConstructorProps = {
  performance_id?: PerformanceId;
  event_id: Uuid;
  establishment_id: Uuid;
  musician_id: Uuid;
  band_id?: Uuid | null;
  repertoire_id?: Uuid | null;
  status?: PerformanceStatus;
  started_at?: Date;
  ended_at?: Date | null;
  songs?: PerformedSong[];
  created_at?: Date;
  updated_at?: Date;
};

export type PerformanceCreateCommand = {
  event_id: string;
  establishment_id: string;
  musician_id: string;
  band_id?: string | null;
  repertoire_id?: string | null;
  started_at?: Date;
};

export type StartSongCommand = {
  title: string;
  artist: string;
  spotify_track_id?: string | null;
  music_library_id?: string | null;
  request_id?: string | null;
  started_at?: Date;
};

/**
 * Set de uma apresentação ao vivo.
 *
 * Ver `Docs/funcionalidades/apresentacao-ao-vivo-set-e-relatorio.md`.
 *
 * 🔴 **O set aberto é o interruptor.** Registrar automaticamente cada música que
 * o Play Mode abre transformaria ensaio em histórico público e envenenaria os
 * três read models (relatório, currículo, setlist) com repetição de estudo. Por
 * isso `startSong` exige um set `live` — não existe "registrar música solta".
 *
 * `musician_id` é quem OPERA o set (é quem o ownership guard autoriza); em show
 * de banda, `band_id` diz em nome de quem se toca.
 */
export class Performance extends AggregateRoot {
  performance_id: PerformanceId;
  event_id: Uuid;
  establishment_id: Uuid;
  musician_id: Uuid;
  band_id: Uuid | null;
  /**
   * A setlist PROGRAMADA — um repertório do músico. `null` = show de improviso.
   *
   * Ponteiro, não snapshot: ao contrário de `title`/`artist` das músicas
   * tocadas, a setlist é um PLANO, e plano pode ser ajustado até a última
   * música. O que prova o show continua sendo `songs`. A posse do repertório é
   * checada no use-case (o agregado não conhece `Repertoire`).
   */
  repertoire_id: Uuid | null;
  status: PerformanceStatus;
  started_at: Date;
  ended_at: Date | null;
  songs: PerformedSong[];
  created_at: Date;
  updated_at: Date;

  constructor(props: PerformanceConstructorProps) {
    super();
    this.performance_id = props.performance_id ?? new PerformanceId();
    this.event_id = props.event_id;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id ?? null;
    this.repertoire_id = props.repertoire_id ?? null;
    this.status = props.status ?? PerformanceStatus.live();
    this.started_at = props.started_at ?? new Date();
    this.ended_at = props.ended_at ?? null;
    this.songs = props.songs ?? [];
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): PerformanceId {
    return this.performance_id;
  }

  static create(command: PerformanceCreateCommand): Performance {
    const performance = new Performance({
      event_id: new Uuid(command.event_id),
      establishment_id: new Uuid(command.establishment_id),
      musician_id: new Uuid(command.musician_id),
      band_id: command.band_id ? new Uuid(command.band_id) : null,
      repertoire_id: command.repertoire_id
        ? new Uuid(command.repertoire_id)
        : null,
      started_at: command.started_at,
    });

    performance.validate();

    if (performance.notification.hasErrors()) {
      throw new EntityValidationError(performance.notification.toJSON());
    }

    performance.applyEvent(
      new PerformanceStartedEvent({
        performance_id: performance.performance_id,
        event_id: performance.event_id.id,
        establishment_id: performance.establishment_id.id,
        musician_id: performance.musician_id.id,
        band_id: performance.band_id?.id ?? null,
        started_at: performance.started_at,
      }),
    );

    return performance;
  }

  // ─── Consultas ─────────────────────────────────────────────────────────────

  /**
   * A música tocando agora, ou `null`.
   *
   * Varre de trás para frente porque a invariante 1 garante que só a última
   * pode estar aberta — mas depender de "é a última" tornaria a leitura errada
   * no dia em que alguém inserisse fora de ordem. Procurar pelo estado real é
   * barato num set de dezenas de músicas.
   */
  get current_song(): PerformedSong | null {
    for (let i = this.songs.length - 1; i >= 0; i--) {
      if (this.songs[i].is_playing) return this.songs[i];
    }
    return null;
  }

  get songs_count(): number {
    return this.songs.length;
  }

  /** Duração do set em segundos; `null` enquanto não encerrado. */
  get duration_seconds(): number | null {
    if (!this.ended_at) return null;
    return Math.max(
      0,
      Math.round((this.ended_at.getTime() - this.started_at.getTime()) / 1000),
    );
  }

  isOwnedBy(musician_id: string): boolean {
    return this.musician_id.id === musician_id;
  }

  // ─── Comandos ──────────────────────────────────────────────────────────────

  /**
   * Começa uma música, fechando automaticamente a anterior.
   *
   * Fechar a anterior AQUI, e não num método separado, é o que torna a
   * invariante "uma música por vez" impossível de violar: não há caminho em que
   * o chamador esqueça. Duas músicas abertas dariam duas respostas para "o que
   * está tocando?".
   */
  startSong(command: StartSongCommand): PerformedSong | null {
    if (this.status.isEnded()) {
      this.notification.addError(
        "Não é possível registrar música em set encerrado",
        "status",
      );
      return null;
    }

    const title = (command.title ?? "").trim();
    const artist = (command.artist ?? "").trim();

    if (!title) {
      this.notification.addError("Título da música é obrigatório", "title");
      return null;
    }

    if (!artist) {
      this.notification.addError("Artista da música é obrigatório", "artist");
      return null;
    }

    // Invariante 5: o mesmo PEDIDO não é tocado duas vezes — contaria dobrado
    // no relatório e no ranking do setlist. Música repetida sem pedido é
    // permitida de propósito: bis existe.
    if (
      command.request_id &&
      this.songs.some((song) => song.request_id === command.request_id)
    ) {
      this.notification.addError(
        "Este pedido já foi registrado como tocado neste set",
        "request_id",
      );
      return null;
    }

    const startedAt = command.started_at ?? new Date();

    // Invariante 6, aplicada à emenda entre músicas: a nova música não pode
    // começar antes da anterior. Sem isto, `ended_at < started_at` gera duração
    // negativa que envenena silenciosamente toda soma de tempo de palco.
    const previous = this.current_song;
    if (previous && startedAt.getTime() < previous.started_at.getTime()) {
      this.notification.addError(
        "A música não pode começar antes da anterior",
        "started_at",
      );
      return null;
    }

    if (previous) previous.ended_at = startedAt;

    // Invariante 3: quem atribui `position` é o agregado. Posição vinda de fora
    // chega duplicada ou com buraco no primeiro retry.
    const song = PerformedSong.create({
      title,
      artist,
      spotify_track_id: command.spotify_track_id ?? null,
      music_library_id: command.music_library_id ?? null,
      request_id: command.request_id ?? null,
      started_at: startedAt,
      position: this.songs.length + 1,
    });

    this.songs.push(song);
    this.updated_at = new Date();

    this.applyEvent(
      new SongStartedEvent({
        performance_id: this.performance_id,
        event_id: this.event_id.id,
        establishment_id: this.establishment_id.id,
        musician_id: this.musician_id.id,
        band_id: this.band_id?.id ?? null,
        performed_song_id: song.performed_song_id,
        music_library_id: song.music_library_id,
        request_id: song.request_id,
        title: song.title,
        artist: song.artist,
        position: song.position,
        started_at: song.started_at,
      }),
    );

    return song;
  }

  /**
   * Troca (ou remove, com `null`) a setlist programada.
   *
   * Só com o set no ar: depois de encerrado, trocar o plano reescreveria o
   * "tocou X das Y planejadas" do relatório de um show que já aconteceu.
   */
  changeSetlist(repertoire_id: string | null): void {
    if (this.status.isEnded()) {
      this.notification.addError(
        "Não é possível trocar a setlist de um set encerrado",
        "status",
      );
      return;
    }
    this.repertoire_id = repertoire_id ? new Uuid(repertoire_id) : null;
    this.updated_at = new Date();
  }

  /**
   * Encerra o set, fechando a música em aberto.
   *
   * Idempotente por decisão: encerrar um set já encerrado devolve o mesmo
   * estado em vez de erro numa ação que, do ponto de vista de quem clicou, deu
   * certo — mesmo raciocínio do `disconnect` do Spotify.
   */
  endPerformance(ended_at?: Date): void {
    if (this.status.isEnded()) return;

    const endedAt = ended_at ?? new Date();

    if (endedAt.getTime() < this.started_at.getTime()) {
      this.notification.addError(
        "O fim do set não pode ser anterior ao início",
        "ended_at",
      );
      return;
    }

    const playing = this.current_song;
    if (playing) {
      // Se o relógio do cliente mandou um fim anterior ao início da última
      // música, fecha com duração zero em vez de negativa.
      playing.ended_at =
        endedAt.getTime() < playing.started_at.getTime()
          ? playing.started_at
          : endedAt;
    }

    this.status = PerformanceStatus.ended();
    this.ended_at = endedAt;
    this.updated_at = new Date();

    this.applyEvent(
      new PerformanceEndedEvent({
        performance_id: this.performance_id,
        event_id: this.event_id.id,
        establishment_id: this.establishment_id.id,
        musician_id: this.musician_id.id,
        band_id: this.band_id?.id ?? null,
        songs_count: this.songs.length,
        started_at: this.started_at,
        ended_at: endedAt,
      }),
    );
  }

  validate(fields?: string[]) {
    const validator = PerformanceValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return PerformanceFakeBuilder;
  }

  toJSON() {
    return {
      performance_id: this.performance_id.id,
      event_id: this.event_id.id,
      establishment_id: this.establishment_id.id,
      musician_id: this.musician_id.id,
      band_id: this.band_id?.id ?? null,
      repertoire_id: this.repertoire_id?.id ?? null,
      status: this.status.value,
      started_at: this.started_at,
      ended_at: this.ended_at,
      songs: this.songs.map((song) => song.toJSON()),
      songs_count: this.songs_count,
      duration_seconds: this.duration_seconds,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
