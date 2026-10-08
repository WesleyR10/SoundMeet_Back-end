import {
  AttendeePresence,
  Event,
  EventId,
  FanLocationReading,
  IEventRepository,
  IVenueLocationPort,
  presenceRefusalMessage,
  PresenceVerifier,
} from "@core/events/domain";
import { Logger } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { EventOutput, EventOutputMapper } from "../common/event-output";

export type AddEventAttendeeInput = {
  establishment_id: string;
  event_id: string;
  audience_id: string;
  /**
   * Quem está registrando a presença. Obrigatório, sem default: um default
   * `"establishment"` faria o caminho do fã pular a verificação no dia em que
   * alguém esquecesse de passar o campo — a defesa sumiria sem quebrar nada.
   *
   * - `audience`: o próprio fã, pelo app — exige evento ao vivo e GPS no raio;
   * - `establishment`: a casa (ou admin) adicionando alguém — confiável por
   *   ser dona do evento; é a liberação manual para GPS ruim lá dentro.
   */
  registered_by: "audience" | "establishment";
  /** Leitura de GPS no ato. Só consultada quando `registered_by === "audience"`. */
  location?: FanLocationReading | null;
};

/**
 * Registra a presença de um fã num evento.
 *
 * 🔴 Até out/2026 este use-case só conferia que o evento existia e era da
 * casa: abrir a tela de pedido em casa chamava esta rota em silêncio e o fã
 * passava a "estar" num show a 800 km, apto a pedir música e a contar no
 * público do músico. A presença agora é verificada por uma leitura pontual de
 * GPS — ver `PresenceVerifier`.
 */
export class AddEventAttendeeUseCase implements IUseCase<
  AddEventAttendeeInput,
  EventOutput
> {
  private readonly logger = new Logger(AddEventAttendeeUseCase.name);

  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly venueLocation: IVenueLocationPort,
    private readonly presenceVerifier: PresenceVerifier,
  ) {}

  async execute(input: AddEventAttendeeInput): Promise<EventOutput> {
    const eventId = new EventId(input.event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event || event.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }

    const now = new Date();
    const presence =
      input.registered_by === "establishment"
        ? ({
            method: "establishment",
            verified_at: now,
            distance_m: null,
          } satisfies AttendeePresence)
        : await this.verifyFan(event, input.location ?? null, now);

    await this.eventRepo.addAttendee(eventId, input.audience_id, now, presence);

    const updated = await this.eventRepo.findById(eventId);
    return EventOutputMapper.toOutput(updated!);
  }

  private async verifyFan(
    event: Event,
    location: FanLocationReading | null,
    now: Date,
  ): Promise<AttendeePresence> {
    /*
     * Só o show que está acontecendo. Antes o fã conseguia marcar presença em
     * evento futuro ou encerrado — a regra do pedido barrava depois, mas a
     * presença ficava contada no público.
     *
     * Vale só para o fã: a casa pode pré-registrar convidado, e é dona do
     * evento.
     */
    if (event.status !== "active") {
      throw new EntityValidationError([
        { event_id: ["Este evento não está acontecendo agora."] },
      ]);
    }

    const venue = await this.venueLocation.findVenueCoordinates(
      event.establishment_id.id,
    );
    const verdict = this.presenceVerifier.verify(location, venue);

    if (!PresenceVerifier.isAccepted(verdict)) {
      throw new EntityValidationError([
        { location: [presenceRefusalMessage(verdict)!] },
      ]);
    }

    if (verdict.kind === "venue_without_coords") {
      // Exceção deliberada (ver `PresenceVerdict`). O log é o que impede ela
      // de ficar invisível: casa sem coordenada desliga a verificação ali.
      this.logger.warn(
        `Presença sem verificação geográfica: casa ${event.establishment_id.id} sem coordenadas (evento ${event.event_id.id})`,
      );
      return {
        method: "venue_without_coords",
        verified_at: now,
        distance_m: null,
      };
    }

    return {
      method: "geo",
      verified_at: now,
      distance_m: verdict.kind === "ok" ? verdict.distance_m : null,
    };
  }
}
