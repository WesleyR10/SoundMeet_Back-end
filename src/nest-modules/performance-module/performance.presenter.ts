import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  PerformanceOutput,
  PerformedSongOutput,
} from "../../core/performance/application/use-cases/common/performance-output";
import { GetLivePerformanceOutput } from "../../core/performance/application/use-cases/get-live-performance/get-live-performance.use-case";
import { GetMusicianResumeOutput } from "../../core/performance/application/use-cases/get-musician-resume/get-musician-resume.use-case";
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

  constructor(output: PerformanceOutput) {
    this.id = output.id;
    this.event_id = output.event_id;
    this.establishment_id = output.establishment_id;
    this.musician_id = output.musician_id;
    this.band_id = output.band_id;
    this.status = output.status;
    this.started_at = output.started_at;
    this.ended_at = output.ended_at;
    this.songs = output.songs.map((s) => new PerformedSongPresenter(s));
    this.songs_count = output.songs_count;
    this.duration_seconds = output.duration_seconds;
    this.current_song = output.current_song
      ? new PerformedSongPresenter(output.current_song)
      : null;
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
