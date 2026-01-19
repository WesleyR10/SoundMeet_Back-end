import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Request } from "./request.aggregate";
import { RequestStatusEnum } from "./value-objects/request-status.vo";

export class RequestRules {
  @IsUUID(4, { groups: ["event_id"] })
  @IsNotEmpty({ groups: ["event_id"] })
  event_id: string;

  @IsUUID(4, { groups: ["audience_id"] })
  @IsNotEmpty({ groups: ["audience_id"] })
  audience_id: string;

  @IsUUID(4, { groups: ["musician_id"] })
  @IsNotEmpty({ groups: ["musician_id"] })
  musician_id: string;

  @MaxLength(200, { groups: ["song_title"] })
  @IsNotEmpty({ groups: ["song_title"] })
  @IsString({ groups: ["song_title"] })
  song_title: string;

  @MaxLength(200, { groups: ["artist"] })
  @IsOptional({ groups: ["artist"] })
  @IsString({ groups: ["artist"] })
  @ValidateIf((o) => o.artist !== null && o.artist !== undefined)
  @IsNotEmpty({
    groups: ["artist"],
    message: "Artist cannot be empty when provided",
  })
  artist: string | null;

  @MaxLength(500, { groups: ["message"] })
  @IsOptional({ groups: ["message"] })
  @IsString({ groups: ["message"] })
  @ValidateIf((o) => o.message !== null && o.message !== undefined)
  @IsNotEmpty({
    groups: ["message"],
    message: "Message cannot be empty when provided",
  })
  message: string | null;

  @IsIn(Object.values(RequestStatusEnum), { groups: ["status"] })
  @IsNotEmpty({ groups: ["status"] })
  status: string;

  constructor(entity: Request | any) {
    // Convert value objects to their primitive values for validation
    this.event_id = entity.event_id?.id || entity.event_id;
    this.audience_id = entity.audience_id?.id || entity.audience_id;
    this.musician_id = entity.musician_id?.id || entity.musician_id;
    this.song_title = entity.song_title?.value || entity.song_title;
    this.artist = entity.artist;
    this.message = entity.message?.value || entity.message;
    this.status = entity.status?.value || entity.status;
  }
}

export class RequestValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "event_id",
          "audience_id",
          "musician_id",
          "song_title",
          "status",
          "artist",
          "message",
        ];

    return super.validate(notification, new RequestRules(data), newFields);
  }
}

export class RequestValidatorFactory {
  static create(): RequestValidator {
    return new RequestValidator();
  }
}
