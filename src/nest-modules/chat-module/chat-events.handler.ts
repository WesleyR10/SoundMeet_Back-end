import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { OpenConversationUseCase } from "../../core/chat/application/use-cases";
import { BookingProposedEvent } from "../../core/scheduling/domain/events/booking-proposed.event";
import { InquiryCreatedEvent } from "../../core/scheduling/domain/events/inquiry-created.event";

/**
 * O chat reage às DUAS portas da negociação.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE `BookingProposedEvent` ENTROU (17/set/2026)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Só `InquiryCreatedEvent` abria canal, e isso não era decisão de produto: era
 * o schema. `conversations.inquiry_id` era NOT NULL, então uma conversa não
 * conseguia existir sem inquiry — e "propor um show", a porta que manda data e
 * cachê, deixava o artista sem onde responder. A UI do estabelecimento chegava
 * a avisar "não abre conversa".
 *
 * ⚠️ **`chat` continua sem conhecer `scheduling` como módulo** — o acoplamento
 * é pelo EVENTO de domínio, importado como tipo, igual ao que já valia para a
 * inquiry. O `ChatModule` não importa o `SchedulingModule`.
 *
 * ⚠️ **O `catch` que engole o erro é deliberado, e vale mais aqui do que na
 * inquiry.** Uma falha ao abrir o canal não pode derrubar o fluxo que já
 * gravou o booking: a proposta existe, o artista precisa recebê-la, e ficar sem
 * chat é degradação — perder a proposta seria perda de negócio. O use case é
 * idempotente, então um reprocessamento posterior fecha a lacuna.
 */
@Injectable()
export class ChatEventsHandler {
  private readonly logger = new Logger(ChatEventsHandler.name);

  constructor(
    private readonly openConversationUseCase: OpenConversationUseCase,
  ) {}

  @OnEvent(InquiryCreatedEvent.name)
  async handleInquiryCreated(event: InquiryCreatedEvent): Promise<void> {
    try {
      await this.openConversationUseCase.execute({
        inquiry_id: event.aggregate_id.id,
        establishment_id: event.establishment_id,
        musician_id: event.musician_id,
        band_id: event.band_id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to open conversation for inquiry ${event.aggregate_id.id}`,
        error,
      );
    }
  }

  @OnEvent(BookingProposedEvent.name)
  async handleBookingProposed(event: BookingProposedEvent): Promise<void> {
    /*
     * 🔴 Booking vindo de CONVERSÃO já tem canal — não abre um segundo.
     *
     * `ConvertInquiryToBookingUseCase` também chama `Booking.create`, então ele
     * emite este mesmo evento; e a inquiry de origem abriu conversa lá atrás,
     * no `InquiryCreatedEvent`. Sem esta guarda a negociação ficaria partida em
     * dois fios — o histórico num, a proposta convertida no outro —, sem nada
     * ligando os dois e sem erro em lugar nenhum.
     *
     * O `return` é silencioso de propósito: não houve falha, houve um canal que
     * já existe.
     */
    if (event.from_inquiry_id !== null) {
      return;
    }

    try {
      await this.openConversationUseCase.execute({
        booking_id: event.aggregate_id.id,
        establishment_id: event.establishment_id,
        musician_id: event.musician_id,
        band_id: event.band_id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to open conversation for booking ${event.aggregate_id.id}`,
        error,
      );
    }
  }
}
