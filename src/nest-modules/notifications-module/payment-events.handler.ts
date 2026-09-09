import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { AudienceId } from "../../core/audience/domain/audience.aggregate";
import { IAudienceRepository } from "../../core/audience/domain/audience.repository";
import { MusicianId } from "../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { PixKeyChangedEvent } from "../../core/payment/domain/events/pix-key-changed.event";
import { TipCompletedEvent } from "../../core/payment/domain/events/tip-completed.event";
import { ITipRepository } from "../../core/payment/domain/repositories";
import { TipId } from "../../core/payment/domain/tip.aggregate";
import { NotificationsGateway } from "./notifications.gateway";
import { PushNotificationService } from "./push-notification.service";

// Handler distinto de PaymentEventsHandlers (payment-module/payment-events.handlers.ts),
// que só cuida de gamificação/message-broker. Este vive em notifications-module,
// mesmo padrão de RequestEventsHandler — escuta eventos de domínio de outro
// módulo via @OnEvent e traduz pra gateway/push.
@Injectable()
export class NotificationsPaymentEventsHandler {
  private readonly logger = new Logger(NotificationsPaymentEventsHandler.name);

  constructor(
    private readonly gateway: NotificationsGateway,
    @Inject("MusicianRepository")
    private readonly musicianRepo: IMusicianRepository,
    @Inject("AudienceRepository")
    private readonly audienceRepo: IAudienceRepository,
    @Inject("TipRepository")
    private readonly tipRepo: ITipRepository,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @OnEvent(TipCompletedEvent.name)
  async handleTipCompleted(event: TipCompletedEvent): Promise<void> {
    const musicianId = event.musician_id?.id ?? null;

    /*
     * O FÃ é avisado SEMPRE, inclusive em gorjeta de banda: quem pagou tem
     * direito de saber que o pagamento entrou. Até aqui o app dele terminava
     * no QR do PIX e nunca mais recebia notícia nenhuma — o pagamento era
     * assíncrono e invisível.
     *
     * ⚠️ Num pedido com destaque este evento e `request.boost.paid` chegam os
     * dois; o app deduplica por `tip_id`.
     */
    this.gateway.notifyTipConfirmed(event.audience_id.id, {
      tip_id: event.aggregate_id.id,
      musician_id: musicianId,
      band_id: event.band_id?.id ?? null,
      amount: event.amount.amount,
      message: null,
      occurred_at: event.occurred_on.toISOString(),
    });

    // Daqui para baixo é a notificação do MÚSICO. Gorjeta de banda não tem um
    // destinatário individual — gateway/push aqui são por músico.
    if (!musicianId) {
      return;
    }

    const tipId = event.aggregate_id.id;
    this.logger.debug(`Handling TipCompletedEvent for musician=${musicianId}`);

    try {
      const [tip, audience] = await Promise.all([
        this.tipRepo.findById(new TipId(tipId)),
        this.audienceRepo.findById(new AudienceId(event.audience_id.id)),
      ]);

      const isAnonymous = tip?.is_anonymous ?? false;
      const fanName = isAnonymous
        ? "Um fã"
        : (audience?.nickname ?? audience?.name ?? "Um fã");

      const payload = {
        tip_id: tipId,
        musician_id: musicianId,
        audience_id: event.audience_id.id,
        amount: event.amount.amount,
        fan_name: fanName,
        message: tip?.message ?? null,
        is_anonymous: isAnonymous,
        occurred_at: event.occurred_on.toISOString(),
      };

      this.gateway.notifyTipReceived(musicianId, payload);

      const musician = await this.musicianRepo.findById(
        new MusicianId(musicianId),
      );

      if (musician?.push_token) {
        await this.pushNotificationService.send(musician.push_token, {
          title: "Gorjeta recebida 💸",
          body: `${fanName} te enviou R$${event.amount.amount.toFixed(2)}`,
          data: { type: "tip.received", tip_id: tipId },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to notify tip.received for tip=${tipId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Chave PIX de recebimento alterada — alerta de segurança por push (A1 camada
   * 2). Canal primário do músico: chega no app na hora, enquanto o saque para a
   * nova chave ainda está na carência. O email (mail-module) cobre o app
   * fechado. Best-effort — nunca desfaz a troca já persistida.
   */
  @OnEvent(PixKeyChangedEvent.name)
  async handlePixKeyChanged(event: PixKeyChangedEvent): Promise<void> {
    const musicianId = event.musician_id.id;
    try {
      const musician = await this.musicianRepo.findById(
        new MusicianId(musicianId),
      );
      if (!musician?.push_token) {
        return;
      }
      await this.pushNotificationService.send(musician.push_token, {
        title: "🔐 Sua chave PIX foi alterada",
        body: "Se não foi você, troque sua senha e fale com o suporte antes que o saque seja liberado.",
        data: { type: "wallet.pix_key_changed" },
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify pix_key_changed for musician=${musicianId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
