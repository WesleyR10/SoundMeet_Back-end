import { AggregateRoot, Points, Uuid } from "../../shared/domain";
import { RequestAcceptedEvent } from "./events/request-accepted.event";
import { RequestBoostChargeCreatedEvent } from "./events/request-boost-charge-created.event";
import { RequestBoostPaidEvent } from "./events/request-boost-paid.event";
import { RequestBoostRefundPendingEvent } from "./events/request-boost-refund-pending.event";
import { RequestCreatedEvent } from "./events/request-created.event";
import { RequestPlayedEvent } from "./events/request-played.event";
import { RequestRejectedEvent } from "./events/request-rejected.event";
import { RequestUpdatedEvent } from "./events/request-updated.event";
import { RequestValidatorFactory } from "./request.validator";
import { RequestFakeBuilder } from "./request-fake.builder";
import { RequestBoost } from "./value-objects/request-boost.vo";
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
  boost?: RequestBoost | null;
};

export type RequestCreateCommand = {
  event_id: string;
  audience_id: string;
  musician_id: string;
  library_id?: string | null;
  song_title: string;
  artist?: string | null;
  message?: string | null;
  boost?: RequestBoost | null;
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
  /**
   * Destaque pago. `null` no pedido comum, que segue sendo o caso normal.
   * Ver `value-objects/request-boost.vo.ts`.
   */
  boost: RequestBoost | null;

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
    this.boost = props.boost ?? null;
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
      boost: props.boost,
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

    /*
     * Destaque de pedido recusado:
     * - sem pagamento ainda (`awaiting_payment`, ou promessa antiga) → cancela;
     *   se o PIX for pago mesmo assim, `markBoostPaid` o manda a reembolso;
     * - JÁ PAGO → `refund_pending`: o fã pagou por um pedido que não vai
     *   acontecer. O reembolso de fato é tarefa aberta (ver o evento).
     * - `expired` fica como está (nada entrou; pagamento tardio vira reembolso).
     */
    if (this.boost?.isPromised || this.boost?.isAwaitingPayment) {
      this.boost = this.boost.cancel("request_rejected");
    } else if (this.boost?.isPaid) {
      this.boost = this.boost.markRefundPending("request_rejected");
      this.applyRefundPendingEvent("request_rejected");
    }

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

  /**
   * Registra o PIX do destaque, criado no instante do pedido.
   *
   * Chamado DEPOIS de o provedor confirmar a criação e ANTES de gravar o
   * pedido — ver `CreateRequestUseCase`: cobrança primeiro, pedido depois. A
   * FK `music_requests.boostTipId -> tips.id` faz o banco exigir essa ordem.
   * O evento é o gatilho do "pague agora" no app do fã.
   */
  markBoostAwaitingPayment(tipId: string): void {
    if (!this.boost) {
      this.notification.addError("Request has no boost to charge", "boost");
      return;
    }
    this.boost = this.boost.withCharge(tipId);
    this.updated_at = new Date();

    this.applyEvent(
      new RequestBoostChargeCreatedEvent({
        request_id: this.request_id,
        audience_id: this.audience_id.id,
        musician_id: this.musician_id.id,
        song_title: this.song_title.value,
        amount: this.boost.amount.amount,
        tip_id: tipId,
        charged_at: this.boost.charged_at!,
      }),
    );
  }

  /**
   * Webhook confirmou o PIX.
   *
   * - pedido aberto (pendente, aceito ou tocado) → `paid`: passa a destacar a
   *   fila e a dedicatória vira pública — inclusive PIX pago fora da janela;
   * - pedido RECUSADO → `refund_pending`: o dinheiro chegou para um pedido que
   *   não vai acontecer. Nem destaque, nem dedicatória, nem celebração.
   */
  markBoostPaid(paidAt?: Date): void {
    if (!this.boost) {
      this.notification.addError("Request has no boost to settle", "boost");
      return;
    }
    if (this.status.isRejected() || this.boost.isCancelled) {
      this.boost = this.boost.markRefundPending("paid_after_rejection", paidAt);
      this.updated_at = new Date();
      this.applyRefundPendingEvent("paid_after_rejection");
      return;
    }
    this.boost = this.boost.markPaid(paidAt);
    this.updated_at = new Date();

    this.applyEvent(
      new RequestBoostPaidEvent({
        request_id: this.request_id,
        audience_id: this.audience_id.id,
        musician_id: this.musician_id.id,
        song_title: this.song_title.value,
        // Só agora a dedicatória sai do círculo de participantes.
        dedication: this.boost.dedication,
        amount: this.boost.amount.amount,
        tip_id: this.boost.tip_id!,
      }),
    );
  }

  /**
   * A janela de pagamento venceu sem PIX. O pedido segue — pendente ou aceito —
   * como pedido COMUM: como nunca destacou, nada muda na fila.
   */
  markBoostExpired(): void {
    if (!this.boost) {
      this.notification.addError("Request has no boost to expire", "boost");
      return;
    }
    this.boost = this.boost.markExpired();
    this.updated_at = new Date();
  }

  /** Promessa do modelo antigo (sem PIX) sendo aceita: nunca será cobrada. */
  cancelBoost(reason: string): void {
    if (!this.boost) {
      return;
    }
    this.boost = this.boost.cancel(reason);
    this.updated_at = new Date();
  }

  private applyRefundPendingEvent(reason: string): void {
    this.applyEvent(
      new RequestBoostRefundPendingEvent({
        request_id: this.request_id,
        audience_id: this.audience_id.id,
        musician_id: this.musician_id.id,
        tip_id: this.boost!.tip_id!,
        amount: this.boost!.amount.amount,
        reason,
      }),
    );
  }

  /** O pedido sobe na fila do músico? Só com destaque PAGO. */
  get isBoosted(): boolean {
    return this.boost?.isBoosting ?? false;
  }

  /**
   * A dedicatória como o PÚBLICO pode vê-la.
   *
   * 🔴 Este getter — e não o campo cru — é o que superfícies públicas devem
   * ler (hoje, o "tocando agora" de `GetLivePerformanceUseCase`). O
   * `RequestOutput` normal pode carregar a dedicatória crua porque toda rota
   * que o serve passa por `assertRequestParticipant`: quem lê ali é o próprio
   * fã, o músico-alvo ou a casa. O músico PRECISA ler antes de aceitar — é
   * metade do motivo para aceitar.
   */
  get publicDedication(): string | null {
    return this.boost?.isPublic ? this.boost.dedication : null;
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
      boost: this.boost?.toJSON() ?? null,
      is_boosted: this.isBoosted,
      points_value: this.pointsValue,
      can_be_accepted: this.canBeAccepted(),
      can_be_rejected: this.canBeRejected(),
      is_within_response_time: this.isWithinResponseTime(),
    };
  }
}
