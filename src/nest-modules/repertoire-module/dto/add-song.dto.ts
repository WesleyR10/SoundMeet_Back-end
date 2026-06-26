import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class AddSongDto {
  @ApiProperty({ example: "uuid-v4", description: "ID da música na biblioteca" })
  @IsUUID("4")
  @IsNotEmpty()
  music_library_id: string;

  @ApiPropertyOptional({ example: "Tocar com capo na 2ª casa", maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  custom_notes?: string | null;

  @ApiPropertyOptional({ example: 210, description: "Override manual da duração em segundos" })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration_override_seconds?: number | null;
}
