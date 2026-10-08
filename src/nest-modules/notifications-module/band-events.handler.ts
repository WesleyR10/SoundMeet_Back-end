import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  BandInviteAcceptedEvent,
  BandInviteDeclinedEvent,
} from "../../core/musician/domain/events/band-invite-responded.event";
import { BandMemberInvitedEvent } from "../../core/musician/domain/events/band-member-invited.event";
import { MusicianId } from "../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { PushNotificationService } from "./push-notification.service";

/**
 * Avisos do convite de banda.
 *
 * 🔴 Até out/2026 o convite não tinha por onde chegar: nenhum evento, nenhum
 * push, e a tela "Minhas bandas" consultava uma rota que só devolvia vínculos
 * aceitos. O convite era gravado e ficava lá, sem ninguém para ver.
 *
 * Hoje são duas pontas: o CONVIDADO fica sabendo que foi chamado, e o LÍDER
 * fica sabendo a resposta. O `data.type` é o que o app usa para abrir a tela
 * certa no toque (`useNotificationResponseListener`).
 *
 * Cada handler engole a própria falha: `DomainEventMediator.publish` espera
 * os handlers, então um push que não saiu não pode derrubar o convite que já
 * foi gravado.
 */
@Injectable()
export class BandEventsHandler {
  private readonly logger = new Logger(BandEventsHandler.name);

  constructor(
    @Inject("MusicianRepository")
    private readonly musicianRepo: IMusicianRepository,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @OnEvent(BandMemberInvitedEvent.name)
  async handleMemberInvited(event: BandMemberInvitedEvent): Promise<void> {
    await this.push(event.musician_id, "band.invite.received", {
      title: "Convite de banda 🎸",
      body: `${event.band_name} te convidou para tocar ${event.instrument}.`,
      data: {
        type: "band.invite.received",
        band_id: event.aggregate_id.id,
      },
    });
  }

  @OnEvent(BandInviteAcceptedEvent.name)
  async handleInviteAccepted(event: BandInviteAcceptedEvent): Promise<void> {
    if (!event.leader_musician_id) return;

    const name = await this.displayNameOf(event.musician_id);
    await this.push(event.leader_musician_id, "band.invite.accepted", {
      title: "Convite aceito 🎉",
      body: `${name} entrou na ${event.band_name}.`,
      data: {
        type: "band.invite.accepted",
        band_id: event.aggregate_id.id,
      },
    });
  }

  @OnEvent(BandInviteDeclinedEvent.name)
  async handleInviteDeclined(event: BandInviteDeclinedEvent): Promise<void> {
    if (!event.leader_musician_id) return;

    const name = await this.displayNameOf(event.musician_id);
    await this.push(event.leader_musician_id, "band.invite.declined", {
      title: "Convite recusado",
      body: `${name} recusou o convite para a ${event.band_name}.`,
      data: {
        type: "band.invite.declined",
        band_id: event.aggregate_id.id,
      },
    });
  }

  private async displayNameOf(musician_id: string): Promise<string> {
    try {
      const musician = await this.musicianRepo.findById(
        new MusicianId(musician_id),
      );
      return musician?.stage_name || musician?.name || "Um músico";
    } catch {
      return "Um músico";
    }
  }

  private async push(
    musician_id: string,
    event: string,
    message: { title: string; body: string; data: Record<string, unknown> },
  ): Promise<void> {
    try {
      const musician = await this.musicianRepo.findById(
        new MusicianId(musician_id),
      );
      // Sem token = app nunca aberto ou logout feito. O aviso continua na
      // tela "Minhas bandas", que é a fonte; o push é só o empurrão.
      if (!musician?.push_token) return;

      await this.pushNotificationService.send(musician.push_token, message);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: `${event}.push_failed`,
          musician_id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
