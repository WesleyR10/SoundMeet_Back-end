import {
  IsDate,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { PerformanceStatusEnum } from "./value-objects/performance-status.vo";

/**
 * ⚠️ Todo decorator declara `{ groups: ["<nome do próprio campo>"] }`.
 *
 * `ClassValidatorFields.validate` repassa `fields` como `groups` do
 * class-validator. Se os decorators não declarassem grupo, passar nomes de
 * propriedade filtraria toda a metadata e o validador responderia *"an unknown
 * value was passed to the validate function"* — parece erro de tipo, é de
 * configuração, e faria TODO set nascer inválido.
 */
export class PerformanceRules {
  @IsNotEmpty({ groups: ["event_id"] })
  @IsString({ groups: ["event_id"] })
  event_id: string;

  @IsNotEmpty({ groups: ["establishment_id"] })
  @IsString({ groups: ["establishment_id"] })
  establishment_id: string;

  @IsNotEmpty({ groups: ["musician_id"] })
  @IsString({ groups: ["musician_id"] })
  musician_id: string;

  @IsOptional({ groups: ["band_id"] })
  @IsString({ groups: ["band_id"] })
  band_id?: string | null;

  @IsIn(Object.values(PerformanceStatusEnum), { groups: ["status"] })
  status: string;

  @IsDate({ groups: ["started_at"] })
  started_at: Date;

  @IsOptional({ groups: ["ended_at"] })
  @IsDate({ groups: ["ended_at"] })
  ended_at?: Date | null;

  constructor(data: any) {
    this.event_id = data.event_id?.id ?? data.event_id;
    this.establishment_id = data.establishment_id?.id ?? data.establishment_id;
    this.musician_id = data.musician_id?.id ?? data.musician_id;
    this.band_id = data.band_id?.id ?? data.band_id ?? null;
    this.status = data.status?.value ?? data.status;
    this.started_at = data.started_at;
    this.ended_at = data.ended_at ?? null;
  }
}

export class PerformanceValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "event_id",
          "establishment_id",
          "musician_id",
          "band_id",
          "status",
          "started_at",
          "ended_at",
        ];
    return super.validate(notification, new PerformanceRules(data), newFields);
  }
}

export class PerformanceValidatorFactory {
  static create() {
    return new PerformanceValidator();
  }
}
