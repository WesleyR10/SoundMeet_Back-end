import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { CHORD_EDIT_TYPES } from "../../../core/personal-chord-sheet/domain/value-objects/chord-edit.vo";

export class ChordEditDto {
  @ApiProperty({ enum: CHORD_EDIT_TYPES })
  @IsIn(CHORD_EDIT_TYPES as unknown as string[])
  type: (typeof CHORD_EDIT_TYPES)[number];

  @ApiProperty({
    description: "Instante do acorde alvo, em ms.",
    example: 2000,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  at_ms: number;

  @ApiPropertyOptional({ description: "Destino do shift_chord, em ms." })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  to_ms?: number;

  @ApiPropertyOptional({ description: 'Símbolo esperado no base (ex.: "Am").' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  from?: string;

  @ApiPropertyOptional({ description: 'Símbolo corrigido (ex.: "Am7").' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  to?: string;

  @ApiPropertyOptional({ description: "Símbolo de insert_chord/shift_chord." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  symbol?: string;

  @ApiPropertyOptional({ description: "Novo rótulo de seção." })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @ApiPropertyOptional({ description: "Texto da anotação." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  text?: string;
}

export class ApplyChordEditsDto {
  @ApiProperty({ type: [ChordEditDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ChordEditDto)
  edits: ChordEditDto[];

  @ApiPropertyOptional({
    enum: ["append", "replace"],
    default: "append",
    description: '"replace" troca a lista inteira de correções.',
  })
  @IsOptional()
  @IsIn(["append", "replace"])
  mode?: "append" | "replace";
}
