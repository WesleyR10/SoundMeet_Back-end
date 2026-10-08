import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { ValueObject } from "../../../shared/domain/value-object";

export enum PerformanceStatusEnum {
  LIVE = "live",
  ENDED = "ended",
}

/**
 * Máquina de estado do set: `live` -> `ended`, sem volta.
 *
 * Não há `cancelled`: um set aberto por engano e encerrado sem música nenhuma
 * já é indistinguível de um cancelamento, e um terceiro estado só criaria a
 * pergunta "conta no currículo?" para todo consumidor dos read models.
 */
export class PerformanceStatus extends ValueObject {
  constructor(readonly value: PerformanceStatusEnum) {
    super();
    this.validate();
  }

  private validate(): void {
    if (this.value === null || this.value === undefined) {
      throw new InvalidArgumentError("Performance status is required");
    }

    if (!Object.values(PerformanceStatusEnum).includes(this.value)) {
      throw new InvalidArgumentError(
        `Invalid performance status: ${this.value}`,
      );
    }
  }

  static create(value: string): PerformanceStatus {
    return new PerformanceStatus(value as PerformanceStatusEnum);
  }

  static live(): PerformanceStatus {
    return new PerformanceStatus(PerformanceStatusEnum.LIVE);
  }

  static ended(): PerformanceStatus {
    return new PerformanceStatus(PerformanceStatusEnum.ENDED);
  }

  isLive(): boolean {
    return this.value === PerformanceStatusEnum.LIVE;
  }

  isEnded(): boolean {
    return this.value === PerformanceStatusEnum.ENDED;
  }

  toString(): string {
    return this.value;
  }

  equals(other: PerformanceStatus): boolean {
    if (!other) return false;
    return this.value === other.value;
  }
}
