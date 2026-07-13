import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class SearchAiCifraCatalogDto {
  @ApiProperty({
    description: "Título ou artista a buscar",
    example: "Bohemian Rhapsody",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  query: string;

  @ApiPropertyOptional({
    description: "Quantidade máxima de resultados",
    example: 15,
    default: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(25)
  limit?: number;
}
