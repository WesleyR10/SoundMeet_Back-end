import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { ValueObject } from "../../../shared/domain/value-object";
import {
  GamificationAction,
  getGamificationPoints,
} from "./gamification-points";

export enum ScoreTypeEnum {
  QR_SCAN = "qr_scan",
  REQUEST_SENT = "request_sent",
  REQUEST_ACCEPTED = "request_accepted",
  TIP_GIVEN = "tip_given",
  SOCIAL_SHARE = "social_share",
  PROFILE_VIEW = "profile_view",
  EVENT_ATTENDANCE = "event_attendance",
  BONUS = "bonus",
}

const SCORE_TYPE_TO_ACTION: Record<ScoreTypeEnum, GamificationAction> = {
  [ScoreTypeEnum.QR_SCAN]: GamificationAction.SCAN_QR,
  [ScoreTypeEnum.REQUEST_SENT]: GamificationAction.REQUEST,
  [ScoreTypeEnum.REQUEST_ACCEPTED]: GamificationAction.ACCEPTED_REQUEST,
  [ScoreTypeEnum.TIP_GIVEN]: GamificationAction.TIP,
  [ScoreTypeEnum.SOCIAL_SHARE]: GamificationAction.SOCIAL_SHARE,
  [ScoreTypeEnum.PROFILE_VIEW]: GamificationAction.PROFILE_VIEW,
  [ScoreTypeEnum.EVENT_ATTENDANCE]: GamificationAction.EVENT_ATTENDANCE,
  [ScoreTypeEnum.BONUS]: GamificationAction.BONUS,
};

export class ScoreType extends ValueObject {
  constructor(readonly value: ScoreTypeEnum) {
    super();
    this.validate();
  }

  private validate(): void {
    if (!Object.values(ScoreTypeEnum).includes(this.value)) {
      throw new InvalidArgumentError(`Invalid score type: ${this.value}`);
    }
  }

  static create(value: string): ScoreType {
    return new ScoreType(value as ScoreTypeEnum);
  }

  static QR_SCAN(): ScoreType {
    return new ScoreType(ScoreTypeEnum.QR_SCAN);
  }

  static REQUEST_SENT(): ScoreType {
    return new ScoreType(ScoreTypeEnum.REQUEST_SENT);
  }

  static REQUEST_ACCEPTED(): ScoreType {
    return new ScoreType(ScoreTypeEnum.REQUEST_ACCEPTED);
  }

  static TIP_GIVEN(): ScoreType {
    return new ScoreType(ScoreTypeEnum.TIP_GIVEN);
  }

  static SOCIAL_SHARE(): ScoreType {
    return new ScoreType(ScoreTypeEnum.SOCIAL_SHARE);
  }

  static PROFILE_VIEW(): ScoreType {
    return new ScoreType(ScoreTypeEnum.PROFILE_VIEW);
  }

  static EVENT_ATTENDANCE(): ScoreType {
    return new ScoreType(ScoreTypeEnum.EVENT_ATTENDANCE);
  }

  static BONUS(): ScoreType {
    return new ScoreType(ScoreTypeEnum.BONUS);
  }

  getPoints(): number {
    return getGamificationPoints(SCORE_TYPE_TO_ACTION[this.value]);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ScoreType): boolean {
    return this.value === other.value;
  }
}
