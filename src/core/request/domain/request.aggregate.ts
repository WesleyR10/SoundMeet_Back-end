import { AggregateRoot, Points, Uuid } from "../../shared/domain";
import { RequestAcceptedEvent } from "./events/request-accepted.event";
import { RequestCreatedEvent } from "./events/request-created.event";
import { RequestPlayedEvent } from "./events/request-played.event";
import { RequestRejectedEvent } from "./events/request-rejected.event";
import { RequestUpdatedEvent } from "./events/request-updated.event";
import { RequestValidatorFactory } from "./request.validator";
import { RequestFakeBuilder } from "./request-fake.builder";
import { RequestMessage } from "./value-objects/request-message.vo";
import {
  RequestStatus,
  RequestStatusEnum,
} from "./value-objects/request-status.vo";
import { SongTitle } from "./value-objects/song-title.vo";

export type RequestConstructorProps = {
  request_id?: RequestId;
  event_id: string;
  audience_id: string;
  musician_id: string;
  library_id?: string | null;
  song_title: string;
  artist?: string | null;
  message?: string | null;
  status?: RequestStatus | string;
  rejection_reason?: string | null;
  votes_count?: number;
  played_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
  responded_at?: Date | null;
};

export type RequestCreateCommand = {
  event_id: string;
  audience_id: string;
  musician_id: string;
  library_id?: string | null;
  song_title: string;
  artist?: string | null;
  message?: string | null;
};

export class RequestId extends Uuid {}

export class Request extends AggregateRoot {
  request_id: RequestId;
  event_id: Uuid;
  audience_id: Uuid;
  musician_id: Uuid;
  library_id: Uuid | null;
  song_title: SongTitle;
  artist: string | null;
  message: RequestMessage | null;
  status: RequestStatus;
  rejection_reason: string | null;
  votes_count: number;
  played_at: Date | null;
  created_at: Date;
  updated_at: Date;
  responded_at: Date | null;

  constructor(props: RequestConstructorProps) {
    super();
    this.request_id = props.request_id ?? new RequestId();
    this.event_id = new Uuid(props.event_id);
    this.audience_id = new Uuid(props.audience_id);
    this.musician_id = new Uuid(props.musician_id);
    this.library_id = props.library_id ? new Uuid(props.library_id) : null;
    this.song_title = SongTitle.create(props.song_title);
    this.artist = props.artist ?? null;
    this.message = props.message ? RequestMessage.create(props.message) : null;
    this.status =
      props.status instanceof RequestStatus
        ? props.status
        : RequestStatus.create(props.status || RequestStatusEnum.PENDING);
    this.rejection_reason = props.rejection_reason ?? null;
    this.votes_count = props.votes_count ?? 0;
    this.played_at = props.played_at ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? this.created_at;
    this.responded_at = props.responded_at ?? null;
  }

  get entity_id(): RequestId {
    return this.request_id;
  }

  static create(props: RequestCreateCommand): Request {
    const request = new Request({
      event_id: props.event_id,
      audience_id: props.audience_id,
      musician_id: props.musician_id,
      library_id: props.library_id,
      song_title: props.song_title,
      artist: props.artist,
      message: props.message,
    });

    request.validate();
    request.applyEvent(
      new RequestCreatedEvent({
        request_id: request.request_id,
        event_id: request.event_id.id,
        audience_id: request.audience_id.id,
        musician_id: request.musician_id.id,
        song_title: request.song_title.value,
        artist: request.artist,
        message: request.message?.value || null,
        created_at: request.created_at,
      }),
    );
    return request;
  }

  accept(): void {
    if (!this.status.isPending()) {
      this.notification.addError(
        "Only pending requests can be accepted",
        "status",
      );
      return;
    }

    this.status = RequestStatus.accepted();
    this.responded_at = new Date();
    this.rejection_reason = null;
    this.updated_at = new Date();

    // Emitir evento para sistema de pontuação
    this.applyEvent(
      new RequestAcceptedEvent({
        request_id: this.request_id,
        event_id: this.event_id.id,
        audience_id: this.audience_id.id,
        musician_id: this.musician_id.id,
        song_title: this.song_title.value,
      }),
    );
  }

  reject(reason?: string): void {
    if (!this.status.isPending()) {
      this.notification.addError(
        "Only pending requests can be rejected",
        "status",
      );
      return;
    }

    this.status = RequestStatus.rejected();
    this.responded_at = new Date();
    this.rejection_reason = reason || null;
    this.updated_at = new Date();

    // Emitir evento para notificação
    this.applyEvent(
      new RequestRejectedEvent({
        request_id: this.request_id,
        event_id: this.event_id.id,
        audience_id: this.audience_id.id,
        musician_id: this.musician_id.id,
        song_title: this.song_title.value,
        rejection_reason: this.rejection_reason,
      }),
    );
  }

  private dispatchUpdateEvent(): void {
    this.applyEvent(
      new RequestUpdatedEvent({
        request_id: this.request_id,
        song_title: this.song_title.value,
        artist: this.artist,
        message: this.message?.value || null,
        updated_at: new Date(),
      }),
    );
    this.updated_at = new Date();
  }

  changeSongTitle(song_title: string): void {
    if (!this.status.isPending()) {
      this.notification.addError(
        "Cannot change song title of non-pending request",
        "song_title",
      );
      return;
    }
    this.song_title = SongTitle.create(song_title);
    this.dispatchUpdateEvent();
  }

  changeArtist(artist: string | null): void {
    if (!this.status.isPending()) {
      this.notification.addError(
        "Cannot change artist of non-pending request",
        "artist",
      );
      return;
    }
    this.artist = artist;
    this.dispatchUpdateEvent();
  }

  changeMessage(message: string | null): void {
    if (!this.status.isPending()) {
      this.notification.addError(
        "Cannot change message of non-pending request",
        "message",
      );
      return;
    }
    this.message = message ? RequestMessage.create(message) : null;
    this.dispatchUpdateEvent();
  }

  markAsPlayed(played_at?: Date): void {
    if (this.status.isRejected()) {
      this.notification.addError(
        "Rejected requests cannot be marked as played",
        "status",
      );
      return;
    }

    if (this.status.isPending()) {
      this.notification.addError(
        "Pending requests cannot be marked as played",
        "status",
      );
      return;
    }

    this.status = RequestStatus.played();
    const playedAt = played_at ?? new Date();
    this.played_at = playedAt;
    this.updated_at = new Date();

    this.applyEvent(
      new RequestPlayedEvent({
        request_id: this.request_id,
        event_id: this.event_id.id,
        audience_id: this.audience_id.id,
        musician_id: this.musician_id.id,
        song_title: this.song_title.value,
        played_at: playedAt,
      }),
    );
  }

  updateVotesCount(votes_count: number): void {
    if (votes_count < 0) {
      this.notification.addError("Votes count cannot be negative", "votes");
      return;
    }
    this.votes_count = votes_count;
    this.updated_at = new Date();
  }

  get isPending(): boolean {
    return this.status.isPending();
  }

  get isAccepted(): boolean {
    return this.status.isAccepted();
  }

  get isPlayed(): boolean {
    return this.status.isPlayed();
  }

  get isRejected(): boolean {
    return this.status.isRejected();
  }

  get isResponded(): boolean {
    return this.responded_at !== null;
  }

  get hasMessage(): boolean {
    return this.message !== null;
  }

  get displayTitle(): string {
    return this.artist
      ? `${this.song_title.value} - ${this.artist}`
      : this.song_title.value;
  }

  get ageInMinutes(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.created_at.getTime();
    return Math.floor(diffMs / (1000 * 60));
  }

  get isRecent(): boolean {
    return this.ageInMinutes <= 30; // Pedido feito nos últimos 30 minutos
  }

  get isOld(): boolean {
    return this.ageInMinutes > 60; // Pedido feito há mais de 1 hora
  }

  get isUrgent(): boolean {
    return this.isPending && this.ageInMinutes > 15; // Pedido pendente há mais de 15 minutos
  }

  get priority(): "low" | "medium" | "high" {
    if (this.isUrgent) return "high";
    if (this.ageInMinutes > 30) return "medium";
    return "low";
  }

  get pointsValue(): Points {
    // Pontos base por fazer um pedido
    const basePoints = Points.createMusicRequest({
      request_id: this.request_id.id,
      song_title: this.song_title.value,
      artist: this.artist,
    });

    // Pontos extras se o pedido for aceito e tocado
    if (this.isPlayed) {
      const acceptedPoints = Points.createAcceptedRequest({
        request_id: this.request_id.id,
        song_title: this.song_title.value,
        artist: this.artist,
        base_points: basePoints.value,
        status: this.status.value,
      });

      // Retorna um novo Points com a soma dos valores
      return Points.create(
        basePoints.value + acceptedPoints.value,
        "accepted_request",
        "Pedido musical aceito e tocado pelo músico",
        {
          request_id: this.request_id.id,
          song_title: this.song_title.value,
          artist: this.artist,
          base_points: basePoints.value,
          accepted_points: acceptedPoints.value,
        },
      );
    }

    return basePoints;
  }

  // Método para verificar se é similar a outro pedido
  isSimilarTo(other: Request): boolean {
    return (
      this.audience_id.equals(other.audience_id) &&
      this.musician_id.equals(other.musician_id) &&
      this.song_title.value.toLowerCase() ===
        other.song_title.value.toLowerCase() &&
      this.artist?.toLowerCase() === other.artist?.toLowerCase()
    );
  }

  // Método para verificar se pode ser aceito
  canBeAccepted(maxResponseTimeMinutes: number = 60): boolean {
    return this.isPending && this.isWithinResponseTime(maxResponseTimeMinutes);
  }

  // Método para verificar se pode ser rejeitado
  canBeRejected(): boolean {
    return this.isPending;
  }

  // Método para verificar se está dentro do tempo de resposta
  isWithinResponseTime(maxResponseTimeMinutes: number = 60): boolean {
    return this.ageInMinutes <= maxResponseTimeMinutes;
  }

  // Método para obter informações de gamificação
  get gamificationInfo() {
    return {
      points: this.pointsValue,
      priority: this.priority,
      isUrgent: this.isUrgent,
      ageInMinutes: this.ageInMinutes,
    };
  }

  // Método para verificar se é um pedido especial (com gorjeta potencial)
  get isSpecialRequest(): boolean {
    return this.hasMessage && this.message!.length > 100;
  }

  validate(fields?: string[]) {
    const validator = RequestValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return RequestFakeBuilder;
  }

  toJSON() {
    return {
      request_id: this.request_id.id,
      event_id: this.event_id.id,
      audience_id: this.audience_id.id,
      musician_id: this.musician_id.id,
      library_id: this.library_id?.id ?? null,
      song_title: this.song_title.value,
      artist: this.artist,
      message: this.message?.value || null,
      status: this.status.value,
      rejection_reason: this.rejection_reason,
      votes_count: this.votes_count,
      played_at: this.played_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
      responded_at: this.responded_at,
      is_pending: this.isPending,
      is_accepted: this.isAccepted,
      is_rejected: this.isRejected,
      is_played: this.isPlayed,
      is_responded: this.isResponded,
      has_message: this.hasMessage,
      display_title: this.displayTitle,
      age_in_minutes: this.ageInMinutes,
      is_recent: this.isRecent,
      is_old: this.isOld,
      is_urgent: this.isUrgent,
      priority: this.priority,
      points_value: this.pointsValue,
      can_be_accepted: this.canBeAccepted(),
      can_be_rejected: this.canBeRejected(),
      is_within_response_time: this.isWithinResponseTime(),
    };
  }
}
