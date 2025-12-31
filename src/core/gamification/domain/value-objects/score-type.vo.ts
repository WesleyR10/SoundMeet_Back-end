import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { ValueObject } from "../../../shared/domain/value-object";

export enum ScoreTypeEnum {
  QR_SCAN = "qr_scan",
  REQUEST_SENT = "request_sent",
  REQUEST_ACCEPTED = "request_accepted",
  TIP_GIVEN = "tip_given",
  SOCIAL_SHARE = "social_share",
  PROFILE_VIEW = "profile_view",
  EVENT_ATTENDANCE = "event_attendance",
}

export class ScoreType extends ValueObject {
  constructor(readonly value: ScoreTypeEnum) {
    super();
    this.validate();
  }

  private validate(): void {
    if (!Object.values(ScoreTypeEnum).includes(this.value)) {
      throw new EntityValidationError([
        {
          score_type: [`Invalid score type: ${this.value}`],
        },
      ]);
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

  getPoints(): number {
    const pointsMap = {
      [ScoreTypeEnum.QR_SCAN]: 10,
      [ScoreTypeEnum.REQUEST_SENT]: 25,
      [ScoreTypeEnum.REQUEST_ACCEPTED]: 50,
      [ScoreTypeEnum.TIP_GIVEN]: 1, // 1 ponto por real
      [ScoreTypeEnum.SOCIAL_SHARE]: 50,
      [ScoreTypeEnum.PROFILE_VIEW]: 5,
      [ScoreTypeEnum.EVENT_ATTENDANCE]: 20,
    };

    return pointsMap[this.value];
  }

  toString(): string {
    return this.value;
  }

  equals(other: ScoreType): boolean {
    return this.value === other.value;
  }
}
