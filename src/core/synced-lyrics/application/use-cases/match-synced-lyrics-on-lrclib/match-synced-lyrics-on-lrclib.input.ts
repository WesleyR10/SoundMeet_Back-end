import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { validateSync } from "class-validator";

export type MatchSyncedLyricsOnLrclibInputConstructorProps = {
  artist: string;
  title: string;
  duration_ms?: number;
  max_results?: number;
};

export class MatchSyncedLyricsOnLrclibInput {
  @IsString()
  @IsNotEmpty()
  artist: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  duration_ms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  max_results?: number;

  constructor(props: MatchSyncedLyricsOnLrclibInputConstructorProps) {
    this.artist = props.artist;
    this.title = props.title;
    this.duration_ms = props.duration_ms;
    this.max_results = props.max_results;
  }
}

export class ValidateMatchSyncedLyricsOnLrclibInput {
  static validate(input: MatchSyncedLyricsOnLrclibInput) {
    return validateSync(input);
  }
}
