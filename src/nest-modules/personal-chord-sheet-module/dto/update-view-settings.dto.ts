import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from "class-validator";

import {
  CHORD_COMPLEXITY_LEVELS,
  CHORD_SHEET_INSTRUMENTS,
  MAX_CAPO_FRET,
  MAX_SCROLL_SPEED,
  MAX_TRANSPOSE_SEMITONES,
  MIN_CAPO_FRET,
  MIN_SCROLL_SPEED,
  MIN_TRANSPOSE_SEMITONES,
  PREFERRED_ACCIDENTALS,
} from "../../../core/personal-chord-sheet/domain/value-objects/chord-sheet-view-settings.vo";

/** PATCH parcial: o que não vier no corpo é preservado (ChordSheetViewSettings.with). */
export class UpdateViewSettingsDto {
  @ApiPropertyOptional({
    minimum: MIN_TRANSPOSE_SEMITONES,
    maximum: MAX_TRANSPOSE_SEMITONES,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_TRANSPOSE_SEMITONES)
  @Max(MAX_TRANSPOSE_SEMITONES)
  @Type(() => Number)
  transpose_semitones?: number;

  @ApiPropertyOptional({ minimum: MIN_CAPO_FRET, maximum: MAX_CAPO_FRET })
  @IsOptional()
  @IsInt()
  @Min(MIN_CAPO_FRET)
  @Max(MAX_CAPO_FRET)
  @Type(() => Number)
  capo_fret?: number;

  @ApiPropertyOptional({ enum: CHORD_COMPLEXITY_LEVELS })
  @IsOptional()
  @IsIn(CHORD_COMPLEXITY_LEVELS as unknown as string[])
  chord_complexity?: (typeof CHORD_COMPLEXITY_LEVELS)[number];

  @ApiPropertyOptional({ enum: CHORD_SHEET_INSTRUMENTS })
  @IsOptional()
  @IsIn(CHORD_SHEET_INSTRUMENTS as unknown as string[])
  instrument?: (typeof CHORD_SHEET_INSTRUMENTS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  left_handed?: boolean;

  @ApiPropertyOptional({ enum: PREFERRED_ACCIDENTALS })
  @IsOptional()
  @IsIn(PREFERRED_ACCIDENTALS as unknown as string[])
  preferred_accidental?: (typeof PREFERRED_ACCIDENTALS)[number];

  @ApiPropertyOptional({ minimum: MIN_SCROLL_SPEED, maximum: MAX_SCROLL_SPEED })
  @IsOptional()
  @IsNumber()
  @Min(MIN_SCROLL_SPEED)
  @Max(MAX_SCROLL_SPEED)
  @Type(() => Number)
  scroll_speed?: number;
}
