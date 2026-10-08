import { haversineKm } from "../../../shared/domain/geo.utils";

/**
 * Uma leitura de GPS do fã, feita NO ATO (check-in ou pedido).
 *
 * 🔴 Nunca é persistida. Do que entra aqui só sobrevivem o veredito, a hora e
 * a distância arredondada — coordenada crua de quem vai a qual bar, gravada,
 * seria um histórico de deslocamento que o produto não precisa ter (LGPD).
 */
export type FanLocationReading = {
  latitude: number;
  longitude: number;
  /** Raio de incerteza informado pelo SO, em metros. */
  accuracy_m: number;
  /**
   * Localização simulada (só o Android informa — `position.mocked`). No iOS
   * vem ausente, e ausente não é prova de nada: o verificador só reprova
   * quando o próprio SO disse `true`.
   */
  mocked?: boolean;
};

export type VenueCoordinates = {
  latitude: number;
  longitude: number;
};

export type PresenceVerdict =
  | { kind: "ok"; distance_m: number }
  /**
   * A casa não tem coordenada cadastrada. Exceção DELIBERADA: a falta é da
   * casa, não do fã, e reprovar aqui tiraria o pedido de música do músico que
   * está tocando lá. Aceita, e quem chama registra o método para que isso
   * apareça em auditoria — ver `isAccepted`.
   */
  | { kind: "venue_without_coords" }
  | { kind: "no_location" }
  | { kind: "mocked" }
  | { kind: "low_accuracy"; accuracy_m: number }
  | { kind: "far"; distance_m: number; limit_m: number };

export type PresenceVerifierConfig = {
  /** Distância máxima até o ponto da casa (`PRESENCE_RADIUS_METERS`). */
  radius_m: number;
  /**
   * Quanto da incerteza do GPS entra como folga. Com teto: sem ele, uma
   * leitura de 2 km de incerteza "caberia" em qualquer raio.
   */
  accuracy_tolerance_cap_m: number;
  /** Acima disto a leitura não serve para decidir nada (`low_accuracy`). */
  max_accuracy_m: number;
};

export const DEFAULT_PRESENCE_VERIFIER_CONFIG: PresenceVerifierConfig = {
  radius_m: 250,
  accuracy_tolerance_cap_m: 150,
  max_accuracy_m: 500,
};

/**
 * O fã está no show?
 *
 * ## Por que uma leitura pontual, e não rastreamento
 *
 * A pergunta é "está lá AGORA, no momento em que pede?" — uma leitura no ato
 * responde. Rastrear continuamente responderia a mesma pergunta gastando
 * bateria e acumulando um histórico de deslocamento. O app já decidiu "sem
 * tracking contínuo" (`useUserLocation.ts`) e esta regra não muda isso.
 *
 * ## O que isto NÃO é
 *
 * Prova forense. GPS falso existe e o iOS não o denuncia. O alvo é o caminho
 * trivial — abrir a Home no sofá e pedir música num bar de outra cidade —,
 * não um fraudador determinado; para esse, o limite diário e o anti-spam do
 * pedido continuam valendo.
 *
 * Serviço puro, sem I/O: quem chama busca as coordenadas da casa
 * (`IVenueLocationPort`) e decide o que fazer com o veredito.
 */
export class PresenceVerifier {
  constructor(
    private readonly config: PresenceVerifierConfig = DEFAULT_PRESENCE_VERIFIER_CONFIG,
  ) {}

  verify(
    reading: FanLocationReading | null | undefined,
    venue: VenueCoordinates | null,
  ): PresenceVerdict {
    if (!venue) {
      return { kind: "venue_without_coords" };
    }
    if (!reading) {
      return { kind: "no_location" };
    }
    if (reading.mocked === true) {
      return { kind: "mocked" };
    }
    if (
      !Number.isFinite(reading.accuracy_m) ||
      reading.accuracy_m > this.config.max_accuracy_m
    ) {
      return { kind: "low_accuracy", accuracy_m: reading.accuracy_m };
    }

    const distance_m = Math.round(
      haversineKm(
        reading.latitude,
        reading.longitude,
        venue.latitude,
        venue.longitude,
      ) * 1000,
    );
    const limit_m =
      this.config.radius_m +
      Math.min(
        Math.max(reading.accuracy_m, 0),
        this.config.accuracy_tolerance_cap_m,
      );

    if (distance_m > limit_m) {
      return { kind: "far", distance_m, limit_m };
    }
    return { kind: "ok", distance_m };
  }

  static isAccepted(verdict: PresenceVerdict): boolean {
    return verdict.kind === "ok" || verdict.kind === "venue_without_coords";
  }
}

/**
 * Mensagem para o fã, por motivo de recusa.
 *
 * 🔴 Chega CRUA na tela (o app mostra a mensagem do 422). Por isso em
 * português e dizendo o que fazer — mesma regra de `can-make-request.policy.ts`.
 * A distância NÃO entra no texto: "você está a 3.412 m" ensina a quem frauda
 * quanto falta ajustar e não ajuda quem está mesmo no bar com GPS ruim.
 */
export function presenceRefusalMessage(
  verdict: PresenceVerdict,
): string | null {
  switch (verdict.kind) {
    case "ok":
    case "venue_without_coords":
      return null;
    case "no_location":
      return "Ative a localização para pedir música: o pedido vale para quem está no show.";
    case "mocked":
      return "Não conseguimos confirmar sua localização. Desative apps de localização simulada e tente de novo.";
    case "low_accuracy":
      return "O sinal de GPS está fraco. Ative a localização precisa e tente de novo.";
    case "far":
      return "Pedido de música é para quem está no show. Você pode mandar uma gorjeta de onde estiver.";
  }
}
