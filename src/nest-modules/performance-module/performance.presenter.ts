import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  PerformanceOutput,
  PerformedSongOutput,
} from "../../core/performance/application/use-cases/common/performance-output";
import { GetLivePerformanceOutput } from "../../core/performance/application/use-cases/get-live-performance/get-live-performance.use-case";
import { GetMusicianNightsOutput } from "../../core/performance/application/use-cases/get-musician-nights/get-musician-nights.use-case";
import { GetMusicianResumeOutput } from "../../core/performance/application/use-cases/get-musician-resume/get-musician-resume.use-case";
import {
  ListStagesOutput,
  StageOutput,
} from "../../core/performance/application/use-cases/list-stages/list-stages.use-case";
import { GetPerformanceReportOutput } from "../../core/performance/application/use-cases/get-performance-report/get-performance-report.use-case";
import { SuggestSetlistOutput } from "../../core/performance/application/use-cases/suggest-setlist/suggest-setlist.use-case";

export class PerformedSongPresenter {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  music_library_id: string | null;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  request_id: string | null;

  @ApiProperty()
  title: string;

  @ApiProperty()
  artist: string;

  @ApiProperty()
  position: number;

  @ApiProperty()
  started_at: Date;

  @ApiPropertyOptional({ nullable: true })
  ended_at: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "`null` quando a música nunca foi fechada — duração desconhecida não é zero.",
  })
  duration_seconds: number | null;

  @ApiProperty()
  is_playing: boolean;

  constructor(output: PerformedSongOutput) {
    Object.assign(this, output);
  }
}

export class PerformancePresenter {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  event_id: string;

  @ApiProperty({ format: "uuid" })
  establishment_id: string;

  @ApiProperty({ format: "uuid" })
  musician_id: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  band_id: string | null;

  @ApiPropertyOptional({
    format: "uuid",
    nullable: true,
    description: "Setlist programada (repertório do músico). `null` = improviso.",
  })
  repertoire_id: string | null;

  @ApiProperty({ enum: ["live", "ended"] })
  status: string;

  @ApiProperty()
  started_at: Date;

  @ApiPropertyOptional({ nullable: true })
  ended_at: Date | null;

  @ApiProperty({ type: [PerformedSongPresenter] })
  songs: PerformedSongPresenter[];

  @ApiProperty()
  songs_count: number;

  @ApiPropertyOptional({ nullable: true })
  duration_seconds: number | null;

  @ApiPropertyOptional({ type: PerformedSongPresenter, nullable: true })
  current_song: PerformedSongPresenter | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Público com check-in, só na leitura do dono com o set no ar. `null` = não se aplica, nunca zero.",
  })
  attendees_count: number | null;

  constructor(output: PerformanceOutput) {
    this.id = output.id;
    this.event_id = output.event_id;
    this.establishment_id = output.establishment_id;
    this.musician_id = output.musician_id;
    this.band_id = output.band_id;
    this.repertoire_id = output.repertoire_id;
    this.status = output.status;
    this.started_at = output.started_at;
    this.ended_at = output.ended_at;
    this.songs = output.songs.map((s) => new PerformedSongPresenter(s));
    this.songs_count = output.songs_count;
    this.duration_seconds = output.duration_seconds;
    this.current_song = output.current_song
      ? new PerformedSongPresenter(output.current_song)
      : null;
    this.attendees_count = output.attendees_count;
  }
}

/**
 * A resposta do fã.
 *
 * Carrega UMA música, nunca a lista: devolver o set inteiro entregaria de graça
 * o repertório que o músico monta como diferencial a qualquer pessoa com o app
 * aberto.
 */
export class LivePerformancePresenter {
  @ApiProperty({
    description:
      "`false` quando não há set aberto — estado normal em intervalo, não erro.",
  })
  is_live: boolean;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  performance_id: string | null;

  @ApiProperty({ format: "uuid" })
  musician_id: string;

  @ApiProperty({ format: "uuid" })
  event_id: string;

  @ApiPropertyOptional({ type: PerformedSongPresenter, nullable: true })
  current_song: PerformedSongPresenter | null;

  @ApiProperty()
  songs_count: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Dedicatória do pedido que originou a música tocando agora. Só é preenchida quando o destaque foi PAGO — dedicatória prometida e não paga nunca sai daqui.",
  })
  current_song_dedication: string | null;

  constructor(output: GetLivePerformanceOutput) {
    this.is_live = output.is_live;
    this.performance_id = output.performance_id;
    this.musician_id = output.musician_id;
    this.event_id = output.event_id;
    this.current_song = output.current_song
      ? new PerformedSongPresenter(output.current_song)
      : null;
    this.songs_count = output.songs_count;
    this.current_song_dedication = output.current_song_dedication;
  }
}

export class PerformanceReportPresenter {
  @ApiProperty({ format: "uuid" })
  performance_id: string;

  @ApiProperty({ format: "uuid" })
  event_id: string;

  @ApiProperty({ format: "uuid" })
  establishment_id: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Nome da casa, para o card compartilhável. `null` quando o estabelecimento foi removido — a UI omite a linha em vez de escrever um placeholder.",
  })
  establishment_name: string | null;

  @ApiProperty({ format: "uuid" })
  musician_id: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  band_id: string | null;

  @ApiProperty()
  started_at: Date;

  @ApiProperty()
  ended_at: Date;

  @ApiPropertyOptional({ nullable: true })
  duration_seconds: number | null;

  @ApiProperty()
  songs_count: number;

  @ApiProperty({ description: "Músicas distintas — bis não conta duas vezes." })
  unique_songs_count: number;

  @ApiProperty({ type: [Object] })
  songs: GetPerformanceReportOutput["songs"];

  @ApiProperty()
  requests_received: number;

  @ApiProperty()
  requests_accepted: number;

  @ApiProperty()
  requests_rejected: number;

  @ApiProperty()
  requests_played: number;

  @ApiProperty()
  tips_count: number;

  @ApiProperty()
  tips_total: number;

  @ApiProperty()
  attendees_count: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Plano × execução: músicas DISTINTAS da setlist que foram tocadas. `null` = show sem setlist.",
  })
  setlist: GetPerformanceReportOutput["setlist"];

  @ApiProperty({
    description:
      "Aviso que viaja com o dado: a gorjeta por música é aproximada por horário.",
  })
  tips_attribution_note: string;

  constructor(output: GetPerformanceReportOutput) {
    Object.assign(this, output);
  }
}

/**
 * Currículo verificado.
 *
 * 🔴 Não há campo de cachê aqui, e não é filtragem: o use-case nunca produz o
 * valor. Este presenter é servido também no perfil público.
 */
export class MusicianResumePresenter {
  @ApiProperty({ format: "uuid" })
  musician_id: string;

  @ApiProperty({ description: "Bookings concluídos, próprios e de banda." })
  shows_completed: number;

  @ApiProperty({ description: "Destes, quantos têm check-in do artista." })
  shows_with_checkin: number;

  @ApiProperty()
  distinct_venues: number;

  @ApiProperty({ type: [Object] })
  venues: GetMusicianResumeOutput["venues"];

  @ApiProperty({ description: "Pessoas distintas, nunca soma de presenças." })
  audience_reached: number;

  @ApiProperty()
  rating_average: number;

  @ApiProperty()
  rating_total: number;

  @ApiProperty({
    description:
      "Cresce a partir do subsistema de apresentação ao vivo; shows antigos não têm registro.",
  })
  distinct_songs_performed: number;

  @ApiPropertyOptional({ nullable: true })
  first_show_at: Date | null;

  @ApiPropertyOptional({ nullable: true })
  last_show_at: Date | null;

  @ApiProperty()
  months_active: number;

  constructor(output: GetMusicianResumeOutput) {
    Object.assign(this, output);
  }
}

/**
 * As noites do período e o resumo do anterior (Analytics do app).
 *
 * Datas saem como ISO; o app agrupa e rotula no fuso do aparelho. Nenhum
 * cachê aqui — o master fala do que o PÚBLICO fez (pedidos, gorjetas,
 * presença), não do que a casa pagou.
 */
export class MusicianNightsPresenter {
  @ApiProperty({ format: "uuid" })
  musician_id: string;

  @ApiProperty({ enum: [7, 30, 90] })
  period_days: number;

  @ApiProperty({
    type: Object,
    description:
      "Janela atual (`from` inclusivo, `to` exclusivo), noites da mais antiga para a mais recente e o resumo.",
  })
  current: GetMusicianNightsOutput["current"];

  @ApiProperty({
    type: Object,
    description: "Janela anterior, do mesmo tamanho e encostada na atual — só o resumo.",
  })
  previous: GetMusicianNightsOutput["previous"];

  constructor(output: GetMusicianNightsOutput) {
    Object.assign(this, output);
  }
}

export class SetlistSuggestionsPresenter {
  @ApiProperty({ format: "uuid" })
  musician_id: string;

  @ApiProperty({ format: "uuid" })
  establishment_id: string;

  @ApiProperty({ type: [Object] })
  suggestions: SuggestSetlistOutput["suggestions"];

  @ApiProperty({
    description:
      "Sinais reais por trás da lista. Zero = ainda não sabemos nada deste local.",
  })
  evidence_count: number;

  constructor(output: SuggestSetlistOutput) {
    Object.assign(this, output);
  }
}

class StageVenuePresenter {
  @ApiProperty({ format: "uuid" }) establishment_id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) avatar: string | null;
  @ApiPropertyOptional({ nullable: true }) cover: string | null;
  @ApiProperty() establishment_type: string;
  @ApiPropertyOptional({ nullable: true }) neighborhood: string | null;
  @ApiPropertyOptional({ nullable: true }) city: string | null;
  @ApiPropertyOptional({ nullable: true }) state: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: "Km até a casa. `null` sem coordenadas — nunca zero.",
  })
  distance_km: number | null;

  constructor(output: StageOutput["venue"]) {
    Object.assign(this, output);
  }
}

class StageNowPlayingPresenter {
  @ApiProperty() title: string;
  @ApiProperty() artist: string;
  @ApiPropertyOptional({ nullable: true }) spotify_url: string | null;
}

class StagePerformerPresenter {
  @ApiPropertyOptional({ format: "uuid", nullable: true }) musician_id: string | null;
  @ApiPropertyOptional({ format: "uuid", nullable: true }) band_id: string | null;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) avatar: string | null;
  @ApiProperty({ type: [String] }) genres: string[];
  @ApiProperty({ description: "Há set aberto agora para este ato." }) is_on_stage: boolean;
  @ApiPropertyOptional({ type: StageNowPlayingPresenter, nullable: true })
  now_playing: StageNowPlayingPresenter | null;
  @ApiProperty() songs_count: number;

  constructor(output: StageOutput["lineup"][number]) {
    Object.assign(this, output);
  }
}

export class StagePresenter {
  @ApiProperty({ format: "uuid" }) event_id: string;
  @ApiProperty() name: string;
  @ApiProperty() start_at: string;
  @ApiProperty() end_at: string;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ nullable: true }) cover_charge: number | null;
  @ApiProperty({ description: "Público com check-in." }) attendees_count: number;
  @ApiPropertyOptional({ nullable: true }) max_capacity: number | null;
  @ApiProperty({ type: StageVenuePresenter }) venue: StageVenuePresenter;
  @ApiProperty({
    type: [StagePerformerPresenter],
    description: "Só escalação confirmada. Nenhum valor de cachê.",
  })
  lineup: StagePerformerPresenter[];

  constructor(output: StageOutput) {
    this.event_id = output.event_id;
    this.name = output.name;
    this.start_at = output.start_at.toISOString();
    this.end_at = output.end_at.toISOString();
    this.status = output.status;
    this.cover_charge = output.cover_charge;
    this.attendees_count = output.attendees_count;
    this.max_capacity = output.max_capacity;
    this.venue = new StageVenuePresenter(output.venue);
    this.lineup = output.lineup.map((p) => new StagePerformerPresenter(p));
  }
}

export class StagesPresenter {
  @ApiProperty({ enum: ["live", "upcoming"] }) window: string;
  @ApiProperty() generated_at: string;
  @ApiProperty({ type: [StagePresenter] }) stages: StagePresenter[];

  constructor(output: ListStagesOutput) {
    this.window = output.window;
    this.generated_at = output.generated_at.toISOString();
    this.stages = output.stages.map((s) => new StagePresenter(s));
  }
}
