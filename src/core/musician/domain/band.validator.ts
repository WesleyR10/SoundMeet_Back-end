
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Band } from "./band.aggregate";
import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Type } from "class-transformer";

export class BandMemberRules {
  @IsNotEmpty()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsString()
  @IsNotEmpty()
  instrument: string;

  @IsDate()
  joined_at: Date;

  constructor(data: any) {
    this.musician_id = data.musician_id;
    this.role = data.role;
    this.instrument = data.instrument;
    this.joined_at = data.joined_at;
  }
}

export class BandRules {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsString()
  @IsOptional()
  avatar?: string | null;

  @IsArray()
  @IsString({ each: true })
  genres: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BandMemberRules)
  members: BandMemberRules[];

  @IsBoolean()
  @IsOptional()
  is_active: boolean;

  @IsDate()
  @IsOptional()
  created_at: Date;

  @IsDate()
  @IsOptional()
  updated_at: Date;

  constructor(entity: Band) {
    this.name = entity.name;
    this.description = entity.description;
    this.avatar = entity.avatar;
    this.genres = entity.genres;
    this.members = entity.members.map((m) => new BandMemberRules({
      musician_id: m.musician_id.id,
      role: m.role,
      instrument: m.instrument,
      joined_at: m.joined_at,
    }));
    this.is_active = entity.is_active;
    this.created_at = entity.created_at;
    this.updated_at = entity.updated_at;
  }
}

export class BandValidator extends ClassValidatorFields<BandRules> {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length ? fields : [];
    return super.validate(notification, new BandRules(data), newFields);
  }
}

export class BandValidatorFactory {
  static create(): BandValidator {
    return new BandValidator();
  }
}
