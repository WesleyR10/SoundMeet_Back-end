import { ValueObject } from "../value-object";

/**
 * Ficha técnica do palco de um estabelecimento (A3).
 *
 * Responde à pergunta que o músico faz antes de aceitar uma proposta: "o que
 * tem lá e o que eu preciso levar?". Hoje isso circula por WhatsApp e a falha
 * clássica é chegar no local e não haver retorno.
 *
 * **Todo campo é opcional por desenho.** Um bar pequeno não sabe responder
 * metade disso, e formulário que exige tudo não é preenchido — meia ficha vale
 * muito mais que ficha nenhuma. `null` significa "não informado", nunca "não
 * tem"; a ausência de PA é `hasPa: false`, e isso é uma informação diferente.
 */

export type StageTechSpecPower = {
  /** Tomadas disponíveis no palco. */
  outlets?: number | null;
  /** Ex.: "110V", "220V", "110V/220V". Texto livre — a realidade é irregular. */
  voltage?: string | null;
};

export type StageTechSpecDimensions = {
  widthM?: number | null;
  depthM?: number | null;
  heightM?: number | null;
};

export type StageTechSpecProps = {
  hasPa?: boolean | null;
  /** Canais disponíveis na mesa de som. */
  mixerChannels?: number | null;
  /** Caixas de retorno de palco. */
  monitors?: number | null;
  hasMicrophones?: number | null;
  /**
   * Equipamento de palco que a casa oferece — bateria, cubo de guitarra,
   * amplificador de baixo, banquetas. Texto livre e normalizado (trim, sem
   * vazios, sem duplicata), no mesmo desenho de `amenities` do perfil.
   */
  backline?: string[];
  dimensions?: StageTechSpecDimensions | null;
  power?: StageTechSpecPower | null;
  hasParking?: boolean | null;
  hasSoundEngineer?: boolean | null;
  /** Janela de passagem de som, ex.: "18:00-19:00". */
  soundcheckWindow?: string | null;
  /** Observações livres do dono. */
  notes?: string | null;
};

/**
 * Forma serializada — é o contrato da coluna `Json` e o que sai no output da
 * aplicação. Mantém o camelCase do VO, como `operating_hours` e `social_links`
 * já fazem: o snake_case vale para o nome do campo de topo, não para dentro.
 */
export type StageTechSpecJSON = {
  hasPa: boolean | null;
  mixerChannels: number | null;
  monitors: number | null;
  hasMicrophones: number | null;
  backline: string[];
  dimensions: StageTechSpecDimensions | null;
  power: StageTechSpecPower | null;
  hasParking: boolean | null;
  hasSoundEngineer: boolean | null;
  soundcheckWindow: string | null;
  notes: string | null;
};

export const STAGE_TECH_SPEC_MAX_BACKLINE_ITEMS = 30;
export const STAGE_TECH_SPEC_MAX_BACKLINE_ITEM_LENGTH = 60;
export const STAGE_TECH_SPEC_MAX_NOTES_LENGTH = 1000;
/** Teto sanitário: qualquer casa real cabe muito abaixo disso. */
const MAX_COUNT = 512;
const MAX_DIMENSION_M = 500;

const TIME_WINDOW_REGEX =
  /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;

export class StageTechSpec extends ValueObject {
  readonly hasPa: boolean | null;
  readonly mixerChannels: number | null;
  readonly monitors: number | null;
  readonly hasMicrophones: number | null;
  readonly backline: string[];
  readonly dimensions: StageTechSpecDimensions | null;
  readonly power: StageTechSpecPower | null;
  readonly hasParking: boolean | null;
  readonly hasSoundEngineer: boolean | null;
  readonly soundcheckWindow: string | null;
  readonly notes: string | null;

  constructor(props: StageTechSpecProps) {
    super();
    this.hasPa = props.hasPa ?? null;
    this.mixerChannels = props.mixerChannels ?? null;
    this.monitors = props.monitors ?? null;
    this.hasMicrophones = props.hasMicrophones ?? null;
    this.backline = StageTechSpec.normalizeBackline(props.backline);
    this.dimensions = StageTechSpec.normalizeDimensions(props.dimensions);
    this.power = StageTechSpec.normalizePower(props.power);
    this.hasParking = props.hasParking ?? null;
    this.hasSoundEngineer = props.hasSoundEngineer ?? null;
    this.soundcheckWindow = StageTechSpec.normalizeText(props.soundcheckWindow);
    this.notes = StageTechSpec.normalizeText(props.notes);

    this.validate();
  }

  /**
   * `true` quando o dono respondeu ao menos um campo. Uma ficha vazia é
   * indistinguível de não ter ficha, e a UI usa isso para não anunciar uma
   * seção sem conteúdo.
   */
  isEmpty(): boolean {
    return (
      this.hasPa === null &&
      this.mixerChannels === null &&
      this.monitors === null &&
      this.hasMicrophones === null &&
      this.backline.length === 0 &&
      this.dimensions === null &&
      this.power === null &&
      this.hasParking === null &&
      this.hasSoundEngineer === null &&
      this.soundcheckWindow === null &&
      this.notes === null
    );
  }

  toJSON(): StageTechSpecJSON {
    return {
      hasPa: this.hasPa,
      mixerChannels: this.mixerChannels,
      monitors: this.monitors,
      hasMicrophones: this.hasMicrophones,
      backline: this.backline,
      dimensions: this.dimensions,
      power: this.power,
      hasParking: this.hasParking,
      hasSoundEngineer: this.hasSoundEngineer,
      soundcheckWindow: this.soundcheckWindow,
      notes: this.notes,
    };
  }

  static fromJSON(json: any): StageTechSpec {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new InvalidStageTechSpecError("Invalid JSON for StageTechSpec");
    }

    return new StageTechSpec({
      hasPa: json.hasPa,
      mixerChannels: json.mixerChannels,
      monitors: json.monitors,
      hasMicrophones: json.hasMicrophones,
      backline: json.backline,
      dimensions: json.dimensions,
      power: json.power,
      hasParking: json.hasParking,
      hasSoundEngineer: json.hasSoundEngineer,
      soundcheckWindow: json.soundcheckWindow,
      notes: json.notes,
    });
  }

  private validate(): void {
    StageTechSpec.assertOptionalBoolean(this.hasPa, "hasPa");
    StageTechSpec.assertOptionalBoolean(this.hasParking, "hasParking");
    StageTechSpec.assertOptionalBoolean(
      this.hasSoundEngineer,
      "hasSoundEngineer",
    );

    StageTechSpec.assertOptionalCount(this.mixerChannels, "mixerChannels");
    StageTechSpec.assertOptionalCount(this.monitors, "monitors");
    StageTechSpec.assertOptionalCount(this.hasMicrophones, "hasMicrophones");

    if (this.backline.length > STAGE_TECH_SPEC_MAX_BACKLINE_ITEMS) {
      throw new InvalidStageTechSpecError(
        `Backline cannot have more than ${STAGE_TECH_SPEC_MAX_BACKLINE_ITEMS} items.`,
      );
    }
    for (const item of this.backline) {
      if (item.length > STAGE_TECH_SPEC_MAX_BACKLINE_ITEM_LENGTH) {
        throw new InvalidStageTechSpecError(
          `Backline item cannot be longer than ${STAGE_TECH_SPEC_MAX_BACKLINE_ITEM_LENGTH} characters.`,
        );
      }
    }

    if (this.dimensions) {
      StageTechSpec.assertOptionalDimension(
        this.dimensions.widthM,
        "dimensions.widthM",
      );
      StageTechSpec.assertOptionalDimension(
        this.dimensions.depthM,
        "dimensions.depthM",
      );
      StageTechSpec.assertOptionalDimension(
        this.dimensions.heightM,
        "dimensions.heightM",
      );
    }

    if (this.power) {
      StageTechSpec.assertOptionalCount(this.power.outlets, "power.outlets");
      if (
        this.power.voltage !== null &&
        this.power.voltage !== undefined &&
        this.power.voltage.length > 40
      ) {
        throw new InvalidStageTechSpecError(
          "Voltage cannot be longer than 40 characters.",
        );
      }
    }

    if (
      this.soundcheckWindow !== null &&
      !TIME_WINDOW_REGEX.test(this.soundcheckWindow)
    ) {
      throw new InvalidStageTechSpecError(
        "Soundcheck window must be in the HH:MM-HH:MM format.",
      );
    }

    if (
      this.notes !== null &&
      this.notes.length > STAGE_TECH_SPEC_MAX_NOTES_LENGTH
    ) {
      throw new InvalidStageTechSpecError(
        `Notes cannot be longer than ${STAGE_TECH_SPEC_MAX_NOTES_LENGTH} characters.`,
      );
    }
  }

  private static assertOptionalBoolean(
    value: boolean | null,
    field: string,
  ): void {
    if (value !== null && typeof value !== "boolean") {
      throw new InvalidStageTechSpecError(`${field} must be a boolean.`);
    }
  }

  /**
   * Contagens são inteiros não negativos. Zero é resposta legítima ("mesa sem
   * canal sobrando", "nenhum retorno") e diferente de `null`.
   */
  private static assertOptionalCount(
    value: number | null | undefined,
    field: string,
  ): void {
    if (value === null || value === undefined) {
      return;
    }
    if (!Number.isInteger(value)) {
      throw new InvalidStageTechSpecError(`${field} must be an integer.`);
    }
    if (value < 0) {
      throw new InvalidStageTechSpecError(`${field} cannot be negative.`);
    }
    if (value > MAX_COUNT) {
      throw new InvalidStageTechSpecError(
        `${field} cannot be greater than ${MAX_COUNT}.`,
      );
    }
  }

  private static assertOptionalDimension(
    value: number | null | undefined,
    field: string,
  ): void {
    if (value === null || value === undefined) {
      return;
    }
    if (!Number.isFinite(value)) {
      throw new InvalidStageTechSpecError(`${field} must be a finite number.`);
    }
    if (value <= 0) {
      throw new InvalidStageTechSpecError(
        `${field} must be greater than zero.`,
      );
    }
    if (value > MAX_DIMENSION_M) {
      throw new InvalidStageTechSpecError(
        `${field} cannot be greater than ${MAX_DIMENSION_M} meters.`,
      );
    }
  }

  private static normalizeText(value?: string | null): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  /** Trim, descarta vazios e remove duplicata preservando a ordem de entrada. */
  private static normalizeBackline(backline?: string[]): string[] {
    if (!Array.isArray(backline)) {
      return [];
    }

    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const raw of backline) {
      if (typeof raw !== "string") {
        throw new InvalidStageTechSpecError("Backline items must be strings.");
      }
      const item = raw.trim();
      if (item.length === 0) {
        continue;
      }
      const key = item.toLocaleLowerCase("pt-BR");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      normalized.push(item);
    }

    return normalized;
  }

  /**
   * Subestrutura toda vazia vira `null` — assim `isEmpty()` e o presenter não
   * precisam distinguir `null` de `{ widthM: null, depthM: null, heightM: null }`.
   */
  private static normalizeDimensions(
    dimensions?: StageTechSpecDimensions | null,
  ): StageTechSpecDimensions | null {
    if (!dimensions || typeof dimensions !== "object") {
      return null;
    }

    const normalized: StageTechSpecDimensions = {
      widthM: dimensions.widthM ?? null,
      depthM: dimensions.depthM ?? null,
      heightM: dimensions.heightM ?? null,
    };

    return normalized.widthM === null &&
      normalized.depthM === null &&
      normalized.heightM === null
      ? null
      : normalized;
  }

  private static normalizePower(
    power?: StageTechSpecPower | null,
  ): StageTechSpecPower | null {
    if (!power || typeof power !== "object") {
      return null;
    }

    const normalized: StageTechSpecPower = {
      outlets: power.outlets ?? null,
      voltage: StageTechSpec.normalizeText(power.voltage),
    };

    return normalized.outlets === null && normalized.voltage === null
      ? null
      : normalized;
  }
}

export class InvalidStageTechSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStageTechSpecError";
  }
}
