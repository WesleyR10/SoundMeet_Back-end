import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";

import { MusicianId } from "../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { ITipRepository } from "../../core/payment/domain/repositories";
import { TipId } from "../../core/payment/domain/tip.aggregate";
import { RequestAcceptedEvent } from "../../core/request/domain/events/request-accepted.event";
import { RequestBoostChargeCreatedEvent } from "../../core/request/domain/events/request-boost-charge-created.event";
import { RequestBoostPaidEvent } from "../../core/request/domain/events/request-boost-paid.event";
import { RequestCreatedEvent } from "../../core/request/domain/events/request-created.event";
import { RequestRejectedEvent } from "../../core/request/domain/events/request-rejected.event";
import { ConfigSchemaType } from "../config-module/config.schema";
import { NotificationsGateway } from "./notifications.gateway";
import { PushNotificationService } from "./push-notification.service";

@Injectable()
export class RequestEventsHandler {
  private readonly logger = new Logger(RequestEventsHandler.name);

  constructor(
    private readonly gateway: NotificationsGateway,
    @Inject("MusicianRepository")
    private readonly musicianRepo: IMusicianRepository,
    private readonly pushNotificationService: PushNotificationService,
    @Inject("TipRepository")
    private readonly tipRepo: ITipRepository,
    @Inject(ConfigService)
    private readonly configService: ConfigSchemaType,
  ) {}

  /**
   * O músico aceitou um pedido com destaque — agora o fã precisa pagar.
   *
   * ⚠️ **Só socket, sem push.** `Audience` não tem `push_token` (só `Musician`
   * tem), então quem estiver com o app fechado neste instante não é avisado.
   * O caminho de recuperação é o banner de cobrança pendente na Home do fã,
   * alimentado por `GET /requests/:request_id/boost/payment` — foi por isso
   * que aquela rota existe. Registrar push de audience é um bloco à parte.
   */
  @OnEvent(RequestBoostChargeCreatedEvent.name)
  async handleBoostChargeCreated(
    event: RequestBoostChargeCreatedEvent,
  ): Promise<void> {
    try {
      // O QR não viaja no evento de domínio: ele é payload de provedor, não
      // fato de negócio. Lido aqui, do repositório de gorjetas.
      const tip = await this.tipRepo.findById(new TipId(event.tip_id));

      const windowMinutes = this.configService.get<number>(
        "REQUEST_BOOST_PAYMENT_WINDOW_MINUTES",
      )!;

      this.gateway.notifyRequestBoostPaymentReady(event.audience_id, {
        request_id: event.request_id.id,
        tip_id: event.tip_id,
        musician_id: event.musician_id,
        song_title: event.song_title,
        amount: event.amount,
        qr_code: tip?.pix_qr_code ?? null,
        copy_paste_code: tip?.pix_copy_paste ?? null,
        expires_at: new Date(
          event.charged_at.getTime() + windowMinutes * 60 * 1000,
        ).toISOString(),
        occurred_at: event.occurred_on.toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify boost payment ready for request=${event.request_id.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Pagamento confirmado: gatilho da celebração no app do fã, e do selo
   * "confirmado" no card da fila do músico.
   */
  @OnEvent(RequestBoostPaidEvent.name)
  async handleBoostPaid(event: RequestBoostPaidEvent): Promise<void> {
    this.gateway.notifyRequestBoostPaid(event.audience_id, {
      request_id: event.request_id.id,
      tip_id: event.tip_id,
      musician_id: event.musician_id,
      song_title: event.song_title,
      dedication: event.dedication,
      amount: event.amount,
      occurred_at: event.occurred_on.toISOString(),
    });

    this.gateway.notifyRequestBoostConfirmedToMusician(event.musician_id, {
      request_id: event.request_id.id,
      tip_id: event.tip_id,
      amount: event.amount,
      song_title: event.song_title,
    });

    try {
      const musician = await this.musicianRepo.findById(
        new MusicianId(event.musician_id),
      );

      if (musician?.push_token) {
        await this.pushNotificationService.send(musician.push_token, {
          title: "Pedido com gorjeta confirmado 🎁",
          body: `${event.song_title} — R$${event.amount.toFixed(2)}`,
          data: {
            type: "request.boost.confirmed",
            request_id: event.request_id.id,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to push boost confirmation for request=${event.request_id.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  @OnEvent(RequestAcceptedEvent.name)
  handleRequestAccepted(event: RequestAcceptedEvent): void {
    this.logger.debug(
      `Handling RequestAcceptedEvent for audience=${event.audience_id}`,
    );
    this.gateway.notifyRequestStatusChanged(event.audience_id, {
      request_id: event.request_id.id,
      status: "accepted",
      musician_id: event.musician_id,
      song_title: event.song_title,
      occurred_at: event.occurred_on.toISOString(),
    });
  }

  @OnEvent(RequestRejectedEvent.name)
  handleRequestRejected(event: RequestRejectedEvent): void {
    this.logger.debug(
      `Handling RequestRejectedEvent for audience=${event.audience_id}`,
    );
    this.gateway.notifyRequestStatusChanged(event.audience_id, {
      request_id: event.request_id.id,
      status: "rejected",
      musician_id: event.musician_id,
      song_title: event.song_title,
      rejection_reason: event.rejection_reason,
      occurred_at: event.occurred_on.toISOString(),
    });
  }

  @OnEvent(RequestCreatedEvent.name)
  async handleRequestCreated(event: RequestCreatedEvent): Promise<void> {
    this.logger.debug(
      `Handling RequestCreatedEvent for musician=${event.musician_id}`,
    );

    this.gateway.notifyNewRequest(event.musician_id, {
      request_id: event.aggregate_id.id,
      event_id: event.event_id,
      audience_id: event.audience_id,
      musician_id: event.musician_id,
      song_title: event.song_title,
      artist: event.artist,
      message: event.message,
      occurred_at: event.occurred_on.toISOString(),
    });

    try {
      const musician = await this.musicianRepo.findById(
        new MusicianId(event.musician_id),
      );

      if (musician?.push_token) {
        await this.pushNotificationService.send(musician.push_token, {
          title: "Novo pedido 🎵",
          body: event.artist
            ? `${event.song_title} — ${event.artist}`
            : event.song_title,
          data: { type: "request.created", request_id: event.aggregate_id.id },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send push notification for request=${event.aggregate_id.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
