import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { MusicLibrary } from "./music-library.aggregate";

export class MusicLibraryRules {
  @MaxLength(255, { groups: ["title"] })
  @IsNotEmpty({ groups: ["title"] })
  @IsString({ groups: ["title"] })
  title: string;

  @MaxLength(255, { groups: ["artist"] })
  @IsNotEmpty({ groups: ["artist"] })
  @IsString({ groups: ["artist"] })
  artist: string;

  @MaxLength(100, { groups: ["genre"] })
  @IsOptional({ groups: ["genre"] })
  @IsString({ groups: ["genre"] })
  genre?: string | null;

  @MaxLength(20, { groups: ["key"] })
  @IsOptional({ groups: ["key"] })
  @IsString({ groups: ["key"] })
  key?: string | null;

  @Min(0, { groups: ["bpm"] })
  @Max(1000, { groups: ["bpm"] })
  @IsNumber({}, { groups: ["bpm"] })
  @IsOptional({ groups: ["bpm"] })
  bpm?: number | null;

  @MaxLength(5000, { groups: ["notes"] })
  @IsOptional({ groups: ["notes"] })
  @IsString({ groups: ["notes"] })
  notes?: string | null;

  @Min(1, { groups: ["difficulty"] })
  @Max(5, { groups: ["difficulty"] })
  @IsInt({ groups: ["difficulty"] })
  difficulty: number;

  @IsBoolean({ groups: ["is_favorite"] })
  @IsOptional({ groups: ["is_favorite"] })
  is_favorite?: boolean;

  @MaxLength(255, { groups: ["source"] })
  @IsOptional({ groups: ["source"] })
  @IsString({ groups: ["source"] })
  source?: string | null;

  constructor(entity: MusicLibrary | any) {
    this.title = entity?.title;
    this.artist = entity?.artist;
    this.genre = entity?.genre;
    this.key = entity?.key;
    this.bpm = entity?.bpm;
    this.notes = entity?.notes;
    this.difficulty = entity?.difficulty;
    this.is_favorite = entity?.is_favorite;
    this.source = entity?.source;
  }
}

export class MusicLibraryValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length ? fields : ["title", "artist"];
    return super.validate(notification, new MusicLibraryRules(data), newFields);
  }
}

export class MusicLibraryValidatorFactory {
  static create(): MusicLibraryValidator {
    return new MusicLibraryValidator();
  }
}
