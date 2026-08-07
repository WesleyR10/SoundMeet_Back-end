import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

import {
  CHORD_COMPLEXITY_LEVELS,
  MAX_CAPO_FRET,
  MAX_TRANSPOSE_SEMITONES,
  MIN_CAPO_FRET,
  MIN_TRANSPOSE_SEMITONES,
} from "../../../core/personal-chord-sheet/domain/value-objects/chord-sheet-view-settings.vo";

/**
 * Prévia EFÊMERA da visualização: sobrepõe a view salva só nesta resposta e não
 * persiste nada. É o que sustenta o "experimentar outro tom" sem sujar a
 * configuração que o músico já escolheu para o show.
 */
export class ChordSheetViewQueryDto {
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
}
