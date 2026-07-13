import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { AudienceId } from "../../core/audience/domain/audience.aggregate";
import { IAudienceRepository } from "../../core/audience/domain/audience.repository";
import { MusicianId } from "../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
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
    // Gorjeta de banda (sem musician_id) não tem um único destinatário
    // individual pra notificar — gateway/push aqui são por músico.
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
}
