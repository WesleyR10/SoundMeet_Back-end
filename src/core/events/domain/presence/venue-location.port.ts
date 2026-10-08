import { VenueCoordinates } from "./presence-verifier";

/**
 * Onde fica a casa do evento.
 *
 * Porta, e não leitura direta de `EstablishmentProfile`, porque `events` e
 * `request` não dependem da infra de `establishment` (Clean Architecture) —
 * mesmo motivo de `ITipEligibilityPort`.
 *
 * `null` quando a casa não tem coordenada cadastrada (o geocoding do perfil é
 * best-effort). Quem decide o que isso significa é o `PresenceVerifier`.
 */
export interface IVenueLocationPort {
  findVenueCoordinates(
    establishment_id: string,
  ): Promise<VenueCoordinates | null>;

  /**
   * Fuso IANA da casa, derivado do endereço (`resolveVenueTimezone`). Nunca
   * `UTC`: sem endereço que resolva, é São Paulo. É o fuso em que "hoje"
   * vale para as regras do show — o processo roda em UTC.
   */
  findVenueTimezone(establishment_id: string): Promise<string>;
}

/**
 * Como a presença do fã no evento foi registrada.
 *
 * - `geo`: leitura do GPS dentro do raio da casa;
 * - `venue_without_coords`: a casa não tem coordenada, então nada foi
 *   verificado — aceito de propósito (ver `PresenceVerdict`);
 * - `establishment`: o próprio estabelecimento (ou admin) adicionou o fã —
 *   a "liberação manual" para GPS ruim dentro da casa.
 */
export type AttendeePresenceMethod =
  | "geo"
  | "venue_without_coords"
  | "establishment";

export type AttendeePresence = {
  method: AttendeePresenceMethod;
  verified_at: Date;
  /** Arredondada em metros; `null` quando não houve leitura de GPS. */
  distance_m: number | null;
};
