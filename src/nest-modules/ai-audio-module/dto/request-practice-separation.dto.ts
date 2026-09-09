import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class RequestPracticeSeparationDto {
  @ApiProperty({
    format: "uuid",
    description:
      "Música da biblioteca do próprio músico. É dela que sai a fonte do áudio e é a ela que os stems ficam ligados, para o app mostrar a cifra ao lado.",
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  music_library_id: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  model_id?: string;

  @ApiPropertyOptional({ enum: ["wav", "flac", "mp3"] })
  @IsIn(["wav", "flac", "mp3"])
  @IsOptional()
  output_format?: "wav" | "flac" | "mp3";
}
