import { ForbiddenException } from "@nestjs/common";

import { EventId } from "../../../events/domain/event.aggregate";
import { IEventRepository } from "../../../events/domain/event.repository";
import { IEventMusicianRepository } from "../../../events/domain/event-musician.repository";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";

export type OpenSetRequest = {
  event_id: string;
  musician_id: string;
  band_id?: string | null;
};

export type OpenSetContext = {
  establishment_id: string;
};

/**
 * Prova que o músico realmente se apresenta naquele evento, antes de deixá-lo
 * abrir um set.
 *
 * 🔴 **Esta é a defesa real da feature do fã.** Sem ela, `POST /performances`
 * seria um endpoint para transmitir "tocando agora" em qualquer bar do país:
 * qualquer músico autenticado poderia sequestrar a tela do público de um show
 * alheio, anunciar as próprias músicas e receber as gorjetas endereçadas ao
 * contexto daquele evento. Ownership do JWT prova *quem é a pessoa*; não prova
 * que ela está no palco.
 *
 * Mesmo raciocínio e mesma fonte de verdade do `ReviewEligibilityService`
 * (`EventMusician`), que existe pelo motivo simétrico: lá impede avaliar quem
 * não tocou, aqui impede tocar onde não foi escalado.
 */
export class PerformanceEligibilityService {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly eventMusicianRepo: IEventMusicianRepository,
  ) {}

  async assertCanOpenSet(request: OpenSetRequest): Promise<OpenSetContext> {
    const eventId = this.toUuid(request.event_id, "evento");

    const event = await this.eventRepo.findById(new EventId(eventId.id));
    if (!event) {
      throw new ForbiddenException("Evento não encontrado.");
    }

    // Show encerrado ou cancelado não recebe set novo. Sem isto, um evento
    // antigo viraria porta dos fundos para inflar o currículo (F4) com
    // execuções que ninguém presenciou — e o F4 vale exatamente porque cada
    // número tem prova.
    if (event.status === "cancelled" || event.status === "completed") {
      throw new ForbiddenException(
        "Não é possível abrir um set num evento encerrado ou cancelado.",
      );
    }

    const performers = await this.eventMusicianRepo.findByEvent(eventId);

    const isPerformer = performers.some((p) => {
      const byMusician = p.musician_id?.id === request.musician_id;
      const byBand = !!request.band_id && p.band_id?.id === request.band_id;
      return byMusician || byBand;
    });

    if (!isPerformer) {
      throw new ForbiddenException("Você não está escalado para este evento.");
    }

    // O estabelecimento nunca vem do cliente: é derivado do evento. Aceitá-lo
    // no corpo deixaria o set gravado num local onde o show não aconteceu, e é
    // por local que o setlist inteligente (F5) e o currículo (F4) agregam.
    return { establishment_id: event.establishment_id.id };
  }

  private toUuid(value: string, label: string): Uuid {
    try {
      return new Uuid(value);
    } catch {
      throw new ForbiddenException(`Identificador de ${label} inválido.`);
    }
  }
}
