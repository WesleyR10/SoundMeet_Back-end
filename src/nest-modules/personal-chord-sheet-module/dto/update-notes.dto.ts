import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

import { MAX_NOTES_LENGTH } from "../../../core/personal-chord-sheet/domain/personal-chord-sheet.aggregate";

export class UpdateNotesDto {
  @ApiPropertyOptional({
    nullable: true,
    maxLength: MAX_NOTES_LENGTH,
    description: "null ou string vazia limpa as anotações.",
  })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @MaxLength(MAX_NOTES_LENGTH)
  notes?: string | null;
}
