import { AggregateRoot, Uuid } from "../../shared/domain";
import {
  BookingStatus,
  BookingStatusEnum,
} from "../../shared/domain/value-objects/booking-status.vo";
import { BookingValidatorFactory } from "./booking.validator";
import { BookingFakeBuilder } from "./booking-fake.builder";
import { BookingCancelledEvent } from "./events/booking-cancelled.event";
import { BookingCompletedEvent } from "./events/booking-completed.event";
import { BookingConfirmedEvent } from "./events/booking-confirmed.event";
import { BookingProposalRevisedEvent } from "./events/booking-proposal-revised.event";
import { BookingProposedEvent } from "./events/booking-proposed.event";

export class BookingId extends Uuid {}

export const BOOKING_DEFAULT_FREE_CANCELLATION_HOURS = 72;

/**
 * Janela de disputa após o show, antes de um booking confirmado ser marcado
 * como completed automaticamente (Docs/_privado/pagamentos/decisoes-de-gateway.md —
 * "Janela de disputa: 24h após o show"). Durante essa janela, qualquer parte
 * pode registrar uma contestação via CancelBooking (com motivo obrigatório).
 */
export const BOOKING_DEFAULT_COMPLETION_DELAY_HOURS = 24;

export type BookingConstructorProps = {
  booking_id?: BookingId;
  establishment_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  start_at: Date;
  end_at: Date;
  fee?: number | null;
  notes?: string | null;
  status?: BookingStatus | string;
  proposed_by?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  buffer_minutes?: number;
  expires_at?: Date | null;
  free_cancellation_hours?: number;
  confirmed_at?: Date | null;
  cancelled_at?: Date | null;
  completed_at?: Date | null;
  checked_in_at?: Date | null;
  checked_in_by?: string | null;
  disputed_at?: Date | null;
  dispute_reason?: string | null;
  created_at?: Date;
  updated_at?: Date;
};

export type BookingCreateCommand = {
  establishment_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  start_at: Date;
  end_at: Date;
  fee?: number | null; // Valor pago pelo estabelecimento
  notes?: string | null; // Notas sobre o agendamento
  buffer_minutes?: number; // Tempo de buffer antes e depois do agendamento
  expires_at?: Date | null;
  free_cancellation_hours?: number;
  /**
   * A inquiry que originou este booking, quando ele nasce de uma conversão.
   *
   * ⚠️ **Não vira propriedade do agregado, de propósito** — o vínculo
   * persistido é `Inquiry.bookingId`, e duplicá-lo aqui criaria duas verdades
   * sobre o mesmo fato. Ele existe só para viajar no `BookingProposedEvent`,
   * que é quem precisa distinguir proposta direta de conversão (ver o JSDoc do
   * evento: sem isso o chat abre uma segunda conversa para uma negociação que
   * já tem uma).
   */
  from_inquiry_id?: string | null;
  /**
   * Lado que originou a proposta — "establishment" | "musician" | "band".
   *
   * Existe porque `assertNegotiationParticipant` autoriza QUALQUER lado da
   * negociação a confirmar, inclusive quem propôs. Sem registrar a origem, um
   * estabelecimento podia confirmar a própria proposta e produzir um booking
   * `confirmed` que o artista nunca aceitou — com a janela de
   * `free_cancellation_hours` já correndo. Este campo é o que permite a um
   * cliente oferecer "confirmar" apenas para a contraparte.
   *
   * ⚠️ Ele NÃO é uma regra de autorização. A API continua aceitando o confirm
   * de ambos os lados; o campo torna a assimetria visível para quem consome.
   */
  proposed_by?: string | null;
};

export class Booking extends AggregateRoot {
  booking_id: BookingId;
  establishment_id: Uuid;
  musician_id: Uuid | null;
  band_id: Uuid | null;
  event_id: Uuid | null;
  start_at: Date;
  end_at: Date;
  fee: number | null;
  notes: string | null;
  status: BookingStatus;
  proposed_by: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  buffer_minutes: number;
  expires_at: Date | null;
  free_cancellation_hours: number;
  confirmed_at: Date | null;
  cancelled_at: Date | null;
  completed_at: Date | null;
  /**
   * Registro da apresentação pelo artista.
   *
   * Vale por si como **prova de execução do serviço** contra chargeback (camada
   * 3 de `decisoes-de-gateway.md`), com ou sem escrow ligado — e é a
   * primeira das duas condições que liberam a custódia.
   */
  checked_in_at: Date | null;
  checked_in_by: string | null;
  /** Contestação do estabelecimento — congela a liberação automática. */
  disputed_at: Date | null;
  dispute_reason: string | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: BookingConstructorProps) {
    super();
    this.booking_id = props.booking_id ?? new BookingId();
    this.establishment_id = new Uuid(props.establishment_id);
    this.musician_id = props.musician_id ? new Uuid(props.musician_id) : null;
    this.band_id = props.band_id ? new Uuid(props.band_id) : null;
    this.event_id = props.event_id ? new Uuid(props.event_id) : null;
    this.start_at = props.start_at;
    this.end_at = props.end_at;
    this.fee = props.fee ?? null;
    this.notes = props.notes ?? null;
    this.status =
      props.status instanceof BookingStatus
        ? props.status
        : BookingStatus.create(props.status || BookingStatusEnum.PENDING);
    this.proposed_by = props.proposed_by ?? null;
    this.cancelled_by = props.cancelled_by ?? null;
    this.cancellation_reason = props.cancellation_reason ?? null;
    this.buffer_minutes = props.buffer_minutes ?? 0;
    this.expires_at = props.expires_at ?? null;
    this.free_cancellation_hours =
      props.free_cancellation_hours ?? BOOKING_DEFAULT_FREE_CANCELLATION_HOURS;
    this.confirmed_at = props.confirmed_at ?? null;
    this.cancelled_at = props.cancelled_at ?? null;
    this.completed_at = props.completed_at ?? null;
    this.checked_in_at = props.checked_in_at ?? null;
    this.checked_in_by = props.checked_in_by ?? null;
    this.disputed_at = props.disputed_at ?? null;
    this.dispute_reason = props.dispute_reason ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): BookingId {
    return this.booking_id;
  }

  get bufferedStartAt(): Date {
    return new Date(this.start_at.getTime() - this.buffer_minutes * 60 * 1000);
  }

  get bufferedEndAt(): Date {
    return new Date(this.end_at.getTime() + this.buffer_minutes * 60 * 1000);
  }

  conflictsWith(booking: Booking): boolean {
    const startA = this.bufferedStartAt.getTime();
    const endA = this.bufferedEndAt.getTime();
    const startB = booking.bufferedStartAt.getTime();
    const endB = booking.bufferedEndAt.getTime();
    return startA < endB && startB < endA;
  }

  static create(props: BookingCreateCommand): Booking {
    const booking = new Booking(props);
    booking.validate();
    booking.assertProposalTerms(booking.fee);
    if (booking.notification.hasErrors()) {
      return booking;
    }
    booking.applyEvent(
      new BookingProposedEvent({
        booking_id: booking.booking_id,
        from_inquiry_id: props.from_inquiry_id ?? null,
        establishment_id: booking.establishment_id.id,
        musician_id: booking.musician_id?.id ?? null,
        band_id: booking.band_id?.id ?? null,
        event_id: booking.event_id?.id ?? null,
        start_at: booking.start_at,
        end_at: booking.end_at,
        fee: booking.fee,
        status: booking.status,
        buffer_minutes: booking.buffer_minutes,
        expires_at: booking.expires_at,
        created_at: booking.created_at,
      }),
    );
    return booking;
  }

  /**
   * 🔴 Proposta é OFERTA: data (já obrigatória no agregado) E valor.
   * Decisão de produto de 25/set/2026 — "para iniciar conversa não precisa,
   * para enviar proposta é obrigatório data e valor". Conversar é a inquiry.
   *
   * Até aqui `fee: null` ("a combinar") passava, e o músico recebia uma
   * "proposta" sem ter o que aceitar. Vale para as duas portas que CRIAM
   * proposta (propor, converter inquiry) e para a revisão — mas NÃO para o
   * construtor: bookings antigos sem cachê continuam carregáveis.
   */
  private assertProposalTerms(fee: number | null): void {
    if (fee === null || fee === undefined || !(fee > 0)) {
      this.notification.addError(
        "Uma proposta precisa de valor (cachê) maior que zero",
        "fee",
      );
    }
  }

  expire(now: Date): void {
    if (!this.status.isPending()) {
      return;
    }
    if (this.expires_at && now.getTime() >= this.expires_at.getTime()) {
      this.status = BookingStatus.expired();
      this.updated_at = now;
    }
  }

  confirm(now: Date): void {
    this.expire(now);
    if (!this.status.isPending()) {
      this.notification.addError(
        "Only pending bookings can be confirmed",
        "status",
      );
      return;
    }
    this.status = BookingStatus.confirmed();
    this.confirmed_at = now;
    this.updated_at = now;
    this.applyEvent(
      new BookingConfirmedEvent({
        booking_id: this.booking_id,
        confirmed_at: now,
      }),
    );
  }

  /**
   * Nova proposta sobre a MESMA negociação — a contraproposta do chat.
   *
   * Existe porque a conversa pertence à negociação (17/set/2026), e negociar é
   * ir e voltar: "pode ser 22h?", "fecho em R$ 900". Sem isto, ajustar um termo
   * exigiria um booking NOVO — e um booking novo emite `BookingProposedEvent`,
   * que abre uma segunda conversa e parte o fio em dois, sem nada ligando um
   * ao outro.
   *
   * ## Quando pode
   *
   * Só enquanto a proposta **nunca foi confirmada**: `pending` (ajuste),
   * `expired` (o prazo venceu sem resposta) ou `cancelled` com `confirmed_at`
   * nulo (a contraparte recusou, ou quem propôs retirou). 🔴 Um booking que já
   * foi confirmado tem contrato emitido e, com escrow, cachê em custódia —
   * reescrever data ou valor dele seria alterar um instrumento assinado. Esse
   * caminho continua sendo cancelar e propor de novo.
   *
   * ## O que muda
   *
   * Termos (início, fim, cachê, observações), autoria (`proposed_by` passa a
   * ser quem revisou — é o que diz aos clientes de quem é a vez de responder)
   * e prazo. Os campos de cancelamento são LIMPOS: a proposta voltou a estar
   * de pé, e manter `cancelled_by` num booking `pending` faria a tela afirmar
   * uma recusa que já não vale. O histórico da negociação mora na conversa.
   */
  reviseProposal(command: {
    start_at: Date;
    end_at: Date;
    fee: number | null;
    notes: string | null;
    proposed_by: "establishment" | "musician" | "band";
    expires_at: Date;
    now: Date;
  }): void {
    this.expire(command.now);

    const neverConfirmed = this.confirmed_at === null;
    const revisable =
      neverConfirmed &&
      (this.status.isPending() ||
        this.status.isExpired() ||
        this.status.isCancelled());

    if (!revisable) {
      this.notification.addError(
        "Only proposals that were never confirmed can be revised",
        "status",
      );
      return;
    }

    /*
     * Uma oferta para o passado não é oferta. `ProposeBookingUseCase` não barra
     * isso hoje; aqui a barreira é do domínio porque a revisão é justamente o
     * caminho de quem reabre uma proposta VENCIDA — o caso em que a data
     * antiga mais provavelmente já passou.
     */
    if (command.start_at.getTime() <= command.now.getTime()) {
      this.notification.addError(
        "A revised proposal must start in the future",
        "start_at",
      );
      return;
    }

    this.assertProposalTerms(command.fee);
    if (this.notification.hasErrors()) {
      return;
    }

    const previousStatus = this.status.value;

    this.start_at = command.start_at;
    this.end_at = command.end_at;
    this.fee = command.fee;
    this.notes = command.notes;
    this.proposed_by = command.proposed_by;
    this.expires_at = command.expires_at;
    this.status = BookingStatus.pending();
    this.cancelled_by = null;
    this.cancellation_reason = null;
    this.cancelled_at = null;
    this.updated_at = command.now;

    if (!this.validate()) {
      return;
    }

    this.applyEvent(
      new BookingProposalRevisedEvent({
        booking_id: this.booking_id,
        establishment_id: this.establishment_id.id,
        musician_id: this.musician_id?.id ?? null,
        band_id: this.band_id?.id ?? null,
        start_at: this.start_at,
        end_at: this.end_at,
        fee: this.fee,
        proposed_by: command.proposed_by,
        previous_status: previousStatus,
        expires_at: this.expires_at,
        revised_at: command.now,
      }),
    );
  }

  cancel(
    now: Date,
    cancelled_by: "establishment" | "musician" | "band",
    reason?: string | null,
  ): void {
    this.expire(now);

    if (this.status.isCancelled() || this.status.isCompleted()) {
      this.notification.addError(
        "Booking cannot be cancelled in current status",
        "status",
      );
      return;
    }

    if (this.status.isExpired()) {
      this.status = BookingStatus.cancelled();
      this.cancelled_by = cancelled_by;
      this.cancellation_reason = reason ?? null;
      this.cancelled_at = now;
      this.updated_at = now;
      this.applyEvent(
        new BookingCancelledEvent({
          booking_id: this.booking_id,
          cancelled_by,
          reason: reason ?? null,
          cancelled_at: now,
          booking_start_at: this.start_at,
        }),
      );
      return;
    }

    if (this.status.isConfirmed()) {
      const msUntilStart = this.start_at.getTime() - now.getTime();
      const hoursUntilStart = msUntilStart / (1000 * 60 * 60);
      const insidePenaltyWindow =
        hoursUntilStart < this.free_cancellation_hours;
      if (insidePenaltyWindow && (!reason || reason.trim().length === 0)) {
        this.notification.addError(
          "Cancellation reason is required within the penalty window",
          "reason",
        );
        return;
      }
    }

    this.status = BookingStatus.cancelled();
    this.cancelled_by = cancelled_by;
    this.cancellation_reason = reason ?? null;
    this.cancelled_at = now;
    this.updated_at = now;
    this.applyEvent(
      new BookingCancelledEvent({
        booking_id: this.booking_id,
        cancelled_by,
        reason: reason ?? null,
        cancelled_at: now,
        booking_start_at: this.start_at,
      }),
    );
  }

  /**
   * O artista registra que a apresentação aconteceu.
   *
   * ## Por que só depois do início, e não do fim
   *
   * O músico faz o check-in **no palco**, não no dia seguinte — é justamente
   * quando ele tem o telefone na mão e a memória fresca. Exigir o fim do show
   * empurraria o registro para depois, e registro adiado é registro que não
   * acontece. Antes do início, porém, seria declarar um fato futuro: é
   * exatamente o tipo de "prova" que não prova nada numa disputa.
   *
   * ## Por que só em booking confirmado
   *
   * Show pendente ainda não é compromisso, e cancelado não aconteceu. Aceitar
   * check-in nos dois criaria prova de execução de um serviço que ninguém
   * contratou — o oposto do que este registro existe para fazer.
   *
   * Idempotente: repetir não move a data. O primeiro registro é o que vale, e
   * sobrescrever permitiria "ajustar" o horário do fato depois.
   */
  checkIn(command: { at: Date; by: "musician" | "band" }): void {
    if (this.checked_in_at !== null) {
      return;
    }

    if (!this.status.isConfirmed()) {
      this.notification.addError(
        "Only confirmed bookings can be checked in",
        "status",
      );
      return;
    }

    if (command.at.getTime() < this.start_at.getTime()) {
      this.notification.addError(
        "Check-in cannot happen before the show starts",
        "checked_in_at",
      );
      return;
    }

    this.checked_in_at = command.at;
    this.checked_in_by = command.by;
    this.updated_at = command.at;
  }

  /**
   * O estabelecimento contesta a execução.
   *
   * Congela a liberação automática da custódia e manda o caso para mediação.
   * `reason` é obrigatório — contestação sem motivo registrado é o que trava
   * dinheiro sem ninguém conseguir dizer por quê.
   *
   * Não exige check-in prévio de propósito: "o artista não apareceu" é
   * justamente a contestação em que o check-in **não** existe.
   */
  dispute(command: { reason: string; at: Date }): void {
    if (!command.reason?.trim()) {
      this.notification.addError("Dispute requires a reason", "dispute_reason");
      return;
    }

    if (!this.status.isConfirmed() && !this.status.isCompleted()) {
      this.notification.addError(
        "Only confirmed or completed bookings can be disputed",
        "status",
      );
      return;
    }

    if (this.disputed_at !== null) {
      return;
    }

    this.disputed_at = command.at;
    this.dispute_reason = command.reason.trim();
    this.updated_at = command.at;
  }

  get isCheckedIn(): boolean {
    return this.checked_in_at !== null;
  }

  get isDisputed(): boolean {
    return this.disputed_at !== null;
  }

  complete(now: Date): void {
    if (!this.status.isConfirmed()) {
      this.notification.addError(
        "Only confirmed bookings can be completed",
        "status",
      );
      return;
    }
    this.status = BookingStatus.completed();
    this.completed_at = now;
    this.updated_at = now;
    this.applyEvent(
      new BookingCompletedEvent({
        booking_id: this.booking_id,
        completed_at: now,
      }),
    );
  }

  validate(fields?: string[]): boolean {
    const validator = BookingValidatorFactory.create();
    validator.validate(this.notification, this, fields);

    const hasMusician = this.musician_id !== null;
    const hasBand = this.band_id !== null;
    if (hasMusician === hasBand) {
      this.notification.addError(
        "Either musician_id or band_id must be provided (exclusively)",
        "target",
      );
    }

    if (this.start_at && this.end_at) {
      if (this.end_at.getTime() <= this.start_at.getTime()) {
        this.notification.addError(
          "end_at must be greater than start_at",
          "end_at",
        );
      }
    }

    if (
      this.expires_at &&
      this.expires_at.getTime() <= this.created_at.getTime()
    ) {
      this.notification.addError(
        "expires_at must be greater than created_at",
        "expires_at",
      );
    }

    if (this.free_cancellation_hours < 0) {
      this.notification.addError(
        "free_cancellation_hours must be greater than or equal to 0",
        "free_cancellation_hours",
      );
    }

    return !this.notification.hasErrors();
  }

  static fake() {
    return BookingFakeBuilder;
  }

  toJSON() {
    return {
      booking_id: this.booking_id.id,
      establishment_id: this.establishment_id.id,
      musician_id: this.musician_id?.id ?? null,
      band_id: this.band_id?.id ?? null,
      event_id: this.event_id?.id ?? null,
      start_at: this.start_at,
      end_at: this.end_at,
      fee: this.fee,
      notes: this.notes,
      status: this.status.value,
      proposed_by: this.proposed_by,
      cancelled_by: this.cancelled_by,
      cancellation_reason: this.cancellation_reason,
      buffer_minutes: this.buffer_minutes,
      expires_at: this.expires_at,
      free_cancellation_hours: this.free_cancellation_hours,
      confirmed_at: this.confirmed_at,
      cancelled_at: this.cancelled_at,
      completed_at: this.completed_at,
      checked_in_at: this.checked_in_at,
      checked_in_by: this.checked_in_by,
      disputed_at: this.disputed_at,
      dispute_reason: this.dispute_reason,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
