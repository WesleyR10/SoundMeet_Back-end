import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Band } from "./band.aggregate";

export class BandMemberRules {
  @IsNotEmpty({ groups: ["members"] })
  @IsString({ groups: ["members"] })
  musician_id: string;

  @IsString({ groups: ["members"] })
  @IsNotEmpty({ groups: ["members"] })
  role: string;

  @IsString({ groups: ["members"] })
  @IsNotEmpty({ groups: ["members"] })
  instrument: string;

  @IsDate({ groups: ["members"] })
  joined_at: Date;

  constructor(data: any) {
    this.musician_id = data.musician_id;
    this.role = data.role;
    this.instrument = data.instrument;
    this.joined_at = data.joined_at;
  }
}

export class BandRules {
  @IsString({ groups: ["name"] })
  @IsNotEmpty({ groups: ["name"] })
  @MaxLength(255, { groups: ["name"] })
  name: string;

  @IsString({ groups: ["description"] })
  @IsOptional({ groups: ["description"] })
  description?: string | null;

  @IsString({ groups: ["avatar"] })
  @IsOptional({ groups: ["avatar"] })
  avatar?: string | null;

  @IsArray({ groups: ["genres"] })
  @IsString({ each: true, groups: ["genres"] })
  genres: string[];

  @IsOptional({ groups: ["members"] })
  @IsArray({ groups: ["members"] })
  @ValidateNested({ each: true, groups: ["members"] })
  @Type(() => BandMemberRules)
  members: BandMemberRules[];

  @IsBoolean({ groups: ["is_active"] })
  @IsOptional({ groups: ["is_active"] })
  is_active: boolean;

  @IsDate({ groups: ["created_at"] })
  @IsOptional({ groups: ["created_at"] })
  created_at: Date;

  @IsDate({ groups: ["updated_at"] })
  @IsOptional({ groups: ["updated_at"] })
  updated_at: Date;

  constructor(entity: Band) {
    this.name = entity.name;
    this.description = entity.description;
    this.avatar = entity.avatar;
    this.genres = entity.genres;
    this.members = entity.members.map(
      (m) =>
        new BandMemberRules({
          musician_id: m.musician_id.id,
          role: m.role,
          instrument: m.instrument,
          joined_at: m.joined_at,
        }),
    );
    this.is_active = entity.is_active;
    this.created_at = entity.created_at;
    this.updated_at = entity.updated_at;
  }
}

export class BandValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : ["name", "genres", "is_active", "members"];
    return super.validate(notification, new BandRules(data), newFields);
  }
}

export class BandValidatorFactory {
  static create(): BandValidator {
    return new BandValidator();
  }
}
