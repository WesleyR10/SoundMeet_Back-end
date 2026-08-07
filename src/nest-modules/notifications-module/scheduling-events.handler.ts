import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  Establishment,
  EstablishmentId,
} from "../../core/establishment/domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../core/establishment/domain/establishment.repository";
import {
  Musician,
  MusicianId,
} from "../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import {
  Booking,
  BookingId,
} from "../../core/scheduling/domain/booking.aggregate";
import { IBookingRepository } from "../../core/scheduling/domain/booking.repository";
import { BookingCancelledEvent } from "../../core/scheduling/domain/events/booking-cancelled.event";
import { BookingConfirmedEvent } from "../../core/scheduling/domain/events/booking-confirmed.event";
import { InquiryAcceptedEvent } from "../../core/scheduling/domain/events/inquiry-accepted.event";
import { InquiryCreatedEvent } from "../../core/scheduling/domain/events/inquiry-created.event";
import { InquiryRejectedEvent } from "../../core/scheduling/domain/events/inquiry-rejected.event";
import { InquiryId } from "../../core/scheduling/domain/inquiry.aggregate";
import { IInquiryRepository } from "../../core/scheduling/domain/inquiry.repository";
import { MailService } from "../mail-module/mail.service";
import {
  BookingUpdatePayload,
  InquiryUpdatePayload,
} from "./dto/notification.payloads";
import { NotificationsGateway } from "./notifications.gateway";
import { PushNotificationService } from "./push-notification.service";

/**
 * Notificações de agenda (Bloco 9.5).
 *
 * Até aqui `BookingEventsHandlers` (scheduling-module) apenas **logava** esses
 * eventos, e os templates `booking-confirmed.tsx`/`booking-cancelled.tsx`
 * existiam sem nenhum chamador — o estabelecimento fechava um show e ninguém
 * era avisado.
 *
 * Divisão de canal seguindo `Docs/email.md`:
 * - **Booking → e-mail** para os dois lados. É *comprovante*: o músico precisa
 *   do registro com data, horário e cachê meses depois. Push some, e-mail fica.
 * - **Inquiry → tempo real** (socket + push). É etapa de negociação, resolvida
 *   no app/dashboard, e um e-mail por proposta viraria ruído.
 *
 * Vive em `notifications-module` (e não em `scheduling-module`) pelo mesmo
 * motivo dos handlers irmãos: traduzir evento de domínio de outro módulo para
 * gateway/push/e-mail sem acoplar o domínio ao transporte.
 */
@Injectable()
export class NotificationsSchedulingEventsHandler {
  private readonly logger = new Logger(
    NotificationsSchedulingEventsHandler.name,
  );

  constructor(
    private readonly gateway: NotificationsGateway,
    private readonly mailService: MailService,
    private readonly pushNotificationService: PushNotificationService,
    @Inject("BookingRepository")
    private readonly bookingRepo: IBookingRepository,
    @Inject("InquiryRepository")
    private readonly inquiryRepo: IInquiryRepository,
    @Inject("MusicianRepository")
    private readonly musicianRepo: IMusicianRepository,
    @Inject("EstablishmentRepository")
    private readonly establishmentRepo: IEstablishmentRepository,
  ) {}

  @OnEvent(BookingConfirmedEvent.name)
  async handleBookingConfirmed(event: BookingConfirmedEvent): Promise<void> {
    await this.handleBookingTransition(event.aggregate_id.id, "confirmed");
  }

  @OnEvent(BookingCancelledEvent.name)
  async handleBookingCancelled(event: BookingCancelledEvent): Promise<void> {
    await this.handleBookingTransition(
      event.aggregate_id.id,
      "cancelled",
      event.cancelled_by,
    );
  }

  /**
   * O evento carrega só o id do booking, então os participantes são resolvidos
   * aqui. Nenhuma falha de notificação pode derrubar a confirmação/cancelamento
   * já commitados — por isso todo o corpo é best-effort.
   */
  private async handleBookingTransition(
    bookingId: string,
    status: "confirmed" | "cancelled",
    cancelledBy?: string | null,
  ): Promise<void> {
    try {
      const booking = await this.bookingRepo.findById(new BookingId(bookingId));
      if (!booking) {
        return;
      }

      const [musician, establishment] = await this.loadParties(booking);

      const payload: BookingUpdatePayload = {
        booking_id: bookingId,
        status,
        establishment_id: booking.establishment_id.id,
        musician_id: booking.musician_id?.id ?? null,
        band_id: booking.band_id?.id ?? null,
        start_at: booking.start_at.toISOString(),
        end_at: booking.end_at.toISOString(),
        cancelled_by: cancelledBy ?? null,
        occurred_at: new Date().toISOString(),
      };

      // Tempo real para os dois lados.
      if (booking.musician_id) {
        this.gateway.notifyBookingUpdate(booking.musician_id.id, payload);
      }
      this.gateway.notifyEstablishmentBookingUpdate(
        booking.establishment_id.id,
        payload,
      );

      await this.sendBookingEmails(
        booking,
        status,
        musician,
        establishment,
        cancelledBy,
      );

      await this.pushBookingToMusician(musician, status, establishment);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: `booking.${status}.notification_failed`,
          booking_id: bookingId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  private async loadParties(
    booking: Booking,
  ): Promise<[Musician | null, Establishment | null]> {
    const [musician, establishment] = await Promise.all([
      booking.musician_id
        ? this.musicianRepo.findById(new MusicianId(booking.musician_id.id))
        : Promise.resolve(null),
      this.establishmentRepo.findById(
        new EstablishmentId(booking.establishment_id.id),
      ),
    ]);
    return [musician, establishment];
  }

  /** E-mail é comprovante: vai para os dois lados, um de cada vez. */
  private async sendBookingEmails(
    booking: Booking,
    status: "confirmed" | "cancelled",
    musician: Musician | null,
    establishment: Establishment | null,
    cancelledBy?: string | null,
  ): Promise<void> {
    const musicianName = musician?.stage_name ?? musician?.name ?? "Músico";
    const establishmentName = establishment?.name ?? "Estabelecimento";
    const eventDate = formatDate(booking.start_at);

    const recipients: Array<{
      email: string | null;
      name: string;
      otherParty: string;
      role: "musician" | "establishment";
    }> = [
      {
        email: musician?.email?.value ?? null,
        name: musicianName,
        otherParty: establishmentName,
        role: "musician",
      },
      {
        email: establishment?.email?.value ?? null,
        name: establishmentName,
        otherParty: musicianName,
        role: "establishment",
      },
    ];

    for (const recipient of recipients) {
      if (!recipient.email) continue;

      try {
        if (status === "confirmed") {
          await this.mailService.sendBookingConfirmed(recipient.email, {
            recipientName: recipient.name,
            otherPartyName: recipient.otherParty,
            role: recipient.role,
            eventDate,
            startTime: formatTime(booking.start_at),
            endTime: formatTime(booking.end_at),
            fee: formatFee(booking.fee),
            location: establishment?.name ?? null,
          });
        } else {
          await this.mailService.sendBookingCancelled(recipient.email, {
            recipientName: recipient.name,
            otherPartyName: recipient.otherParty,
            eventDate,
            reason: cancelledBy ? `Cancelado por: ${cancelledBy}` : null,
          });
        }
      } catch (error) {
        // Falhar para um destinatário não pode impedir o outro de ser avisado.
        this.logger.warn(
          JSON.stringify({
            event: "booking.email_failed",
            role: recipient.role,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
  }

  private async pushBookingToMusician(
    musician: Musician | null,
    status: "confirmed" | "cancelled",
    establishment: Establishment | null,
  ): Promise<void> {
    if (!musician?.push_token) return;

    const venue = establishment?.name ?? "um estabelecimento";
    await this.pushNotificationService.send(musician.push_token, {
      title: status === "confirmed" ? "Show confirmado 🎉" : "Show cancelado",
      body:
        status === "confirmed"
          ? `Seu show em ${venue} foi confirmado.`
          : `Seu show em ${venue} foi cancelado.`,
      data: { type: `booking.${status}` },
    });
  }

  // ------------------------------------------------------------------
  // Inquiries — tempo real, sem e-mail (etapa de negociação, não comprovante)
  // ------------------------------------------------------------------

  @OnEvent(InquiryCreatedEvent.name)
  async handleInquiryCreated(event: InquiryCreatedEvent): Promise<void> {
    // Este evento já carrega os participantes — não precisa recarregar nada.
    const payload: InquiryUpdatePayload = {
      inquiry_id: event.aggregate_id.id,
      status: "created",
      establishment_id: event.establishment_id,
      musician_id: event.musician_id,
      band_id: event.band_id,
      subject: event.subject,
      occurred_at: new Date().toISOString(),
    };

    if (event.musician_id) {
      this.gateway.notifyInquiryUpdate(event.musician_id, payload);
      await this.pushInquiryToMusician(
        event.musician_id,
        event.establishment_id,
      );
    }
  }

  @OnEvent(InquiryAcceptedEvent.name)
  async handleInquiryAccepted(event: InquiryAcceptedEvent): Promise<void> {
    await this.notifyInquiryDecision(event.aggregate_id.id, "accepted");
  }

  @OnEvent(InquiryRejectedEvent.name)
  async handleInquiryRejected(event: InquiryRejectedEvent): Promise<void> {
    await this.notifyInquiryDecision(event.aggregate_id.id, "rejected");
  }

  /**
   * Aceite/recusa interessam ao ESTABELECIMENTO, que está no dashboard web
   * esperando resposta. Os eventos só trazem o id, então a inquiry é carregada
   * para descobrir de quem é.
   */
  private async notifyInquiryDecision(
    inquiryId: string,
    status: "accepted" | "rejected",
  ): Promise<void> {
    try {
      const inquiry = await this.inquiryRepo.findById(new InquiryId(inquiryId));
      if (!inquiry) return;

      const payload: InquiryUpdatePayload = {
        inquiry_id: inquiryId,
        status,
        establishment_id: inquiry.establishment_id.id,
        musician_id: inquiry.musician_id?.id ?? null,
        band_id: inquiry.band_id?.id ?? null,
        subject: inquiry.subject ?? null,
        occurred_at: new Date().toISOString(),
      };

      this.gateway.notifyEstablishmentInquiryUpdate(
        inquiry.establishment_id.id,
        payload,
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: `inquiry.${status}.notification_failed`,
          inquiry_id: inquiryId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  private async pushInquiryToMusician(
    musicianId: string,
    establishmentId: string,
  ): Promise<void> {
    try {
      const [musician, establishment] = await Promise.all([
        this.musicianRepo.findById(new MusicianId(musicianId)),
        this.establishmentRepo.findById(new EstablishmentId(establishmentId)),
      ]);

      if (!musician?.push_token) return;

      await this.pushNotificationService.send(musician.push_token, {
        title: "Nova proposta de show 🎤",
        body: `${establishment?.name ?? "Um estabelecimento"} quer te contratar.`,
        data: { type: "inquiry.created" },
      });
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "inquiry.push_failed",
          musician_id: musicianId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFee(fee: { amount: number } | number | null): string {
  const value = typeof fee === "number" ? fee : (fee?.amount ?? 0);
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
