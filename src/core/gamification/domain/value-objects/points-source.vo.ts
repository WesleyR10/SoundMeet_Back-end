import { ValueObject } from "../../../shared/domain/value-object";
import {
  GamificationAction,
  getGamificationPoints,
} from "./gamification-points";

export enum PointsSourceEnum {
  SCAN_QR = "scan_qr",
  REQUEST = "request",
  ACCEPTED_REQUEST = "accepted_request",
  TIP = "tip",
  SOCIAL_SHARE = "social_share",
  BONUS = "bonus",
}

export type PointsSourceProps = {
  value: PointsSourceEnum;
};

export class PointsSource extends ValueObject {
  readonly value: PointsSourceEnum;

  constructor(props: PointsSourceProps) {
    super();
    this.value = props.value;
    this.validate();
  }

  private validate(): void {
    if (!Object.values(PointsSourceEnum).includes(this.value)) {
      throw new InvalidPointsSourceError(
        `Invalid points source: ${this.value}`,
      );
    }
  }

  static create(value: string | PointsSourceEnum): PointsSource {
    return new PointsSource({ value: value as PointsSourceEnum });
  }

  static scanQr(): PointsSource {
    return new PointsSource({ value: PointsSourceEnum.SCAN_QR });
  }

  static request(): PointsSource {
    return new PointsSource({ value: PointsSourceEnum.REQUEST });
  }

  static acceptedRequest(): PointsSource {
    return new PointsSource({ value: PointsSourceEnum.ACCEPTED_REQUEST });
  }

  static tip(): PointsSource {
    return new PointsSource({ value: PointsSourceEnum.TIP });
  }

  static socialShare(): PointsSource {
    return new PointsSource({ value: PointsSourceEnum.SOCIAL_SHARE });
  }

  static bonus(): PointsSource {
    return new PointsSource({ value: PointsSourceEnum.BONUS });
  }

  isScanQr(): boolean {
    return this.value === PointsSourceEnum.SCAN_QR;
  }

  isRequest(): boolean {
    return this.value === PointsSourceEnum.REQUEST;
  }

  isAcceptedRequest(): boolean {
    return this.value === PointsSourceEnum.ACCEPTED_REQUEST;
  }

  isTip(): boolean {
    return this.value === PointsSourceEnum.TIP;
  }

  isSocialShare(): boolean {
    return this.value === PointsSourceEnum.SOCIAL_SHARE;
  }

  isBonus(): boolean {
    return this.value === PointsSourceEnum.BONUS;
  }

  getPointsValue(): number {
    // Os valores de PointsSourceEnum coincidem com GamificationAction.
    return getGamificationPoints(this.value as unknown as GamificationAction);
  }

  toString(): string {
    return this.value;
  }

  toJSON() {
    return {
      value: this.value,
      points_value: this.getPointsValue(),
    };
  }
}

export class InvalidPointsSourceError extends Error {
  constructor(message?: string) {
    super(message || "Invalid points source");
    this.name = "InvalidPointsSourceError";
  }
}
