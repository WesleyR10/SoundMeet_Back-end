import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class PreloadPopularChordSheetsItemDto {
  @ApiProperty({ example: "Evidências" })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: "Chitãozinho & Xororó" })
  @IsString()
  @MaxLength(255)
  artist: string;

  @ApiProperty({ example: "simpmusic" })
  @IsString()
  @IsIn(["simpmusic", "musify"])
  provider: "simpmusic" | "musify";

  @ApiProperty({ example: "dQw4w9WgXcQ" })
  @IsString()
  @MaxLength(255)
  youtube_video_id: string;

  @ApiPropertyOptional({
    description: "ID do item na MusicLibrary para persistir metadados e cifra",
    example: "9366b7dc-2d71-4799-b91c-c64adb205104",
  })
  @IsOptional()
  @IsUUID("4")
  music_library_id?: string;

  @ApiPropertyOptional({
    description: "ID do modelo de análise (ex: crema_v1)",
    example: "crema_v1",
  })
  @IsOptional()
  @IsString()
  model_id?: string;
}

export class PreloadPopularChordSheetsDto {
  @ApiProperty({ type: [PreloadPopularChordSheetsItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PreloadPopularChordSheetsItemDto)
  items: PreloadPopularChordSheetsItemDto[];
}
