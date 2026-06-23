import {
  IsDate,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { EventMusician } from "./event-musician.aggregate";

export class EventMusicianRules {
  @IsNotEmpty({ groups: ["event_id"] })
  @IsString({ groups: ["event_id"] })
  event_id: string;

  @IsOptional({ groups: ["musician_id"] })
  @IsString({ groups: ["musician_id"] })
  musician_id?: string | null;

  @IsOptional({ groups: ["band_id"] })
  @IsString({ groups: ["band_id"] })
  band_id?: string | null;

  @IsNumber({}, { groups: ["fee"] })
  @Min(0, { groups: ["fee"] })
  @IsOptional({ groups: ["fee"] })
  fee?: number | null;

  @IsIn(["confirmed", "pending", "cancelled"], { groups: ["status"] })
  @IsOptional({ groups: ["status"] })
  status?: string;

  @IsDate({ groups: ["start_at"] })
  @IsOptional({ groups: ["start_at"] })
  start_at?: Date | null;

  @IsDate({ groups: ["end_at"] })
  @IsOptional({ groups: ["end_at"] })
  end_at?: Date | null;

  constructor(entity: EventMusician | any) {
    Object.assign(this, {
      event_id: entity.event_id?.id ?? entity.event_id,
      musician_id: entity.musician_id?.id ?? entity.musician_id ?? null,
      band_id: entity.band_id?.id ?? entity.band_id ?? null,
      fee: entity.fee,
      status: entity.status,
      start_at: entity.start_at,
      end_at: entity.end_at,
    });
  }
}

export class EventMusicianValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "event_id",
          "musician_id",
          "band_id",
          "fee",
          "status",
          "start_at",
          "end_at",
        ];
    return super.validate(
      notification,
      new EventMusicianRules(data),
      newFields,
    );
  }
}

export class EventMusicianValidatorFactory {
  static create(): EventMusicianValidator {
    return new EventMusicianValidator();
  }
}
