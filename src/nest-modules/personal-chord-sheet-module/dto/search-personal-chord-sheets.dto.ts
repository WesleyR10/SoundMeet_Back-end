import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class SearchPersonalChordSheetsDto {
  // @Type(() => Number) é obrigatório: query string chega como string e o
  // ValidationPipe global devolve 422 em toda chamada sem ele (roadmap 7.17).
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  per_page?: number;

  @ApiPropertyOptional({ enum: ["created_at", "updated_at", "shared_at"] })
  @IsOptional()
  @IsIn(["created_at", "updated_at", "shared_at"])
  sort?: string | null;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sort_dir?: "asc" | "desc" | null;

  @ApiPropertyOptional({ format: "uuid", description: "Filtrar por música." })
  @IsOptional()
  @IsUUID("4")
  music_library_id?: string;

  @ApiPropertyOptional({
    enum: ["clean", "base_updated"],
    description: '"base_updated" lista só os forks com reconciliação pendente.',
  })
  @IsOptional()
  @IsIn(["clean", "base_updated"])
  reconcile_status?: "clean" | "base_updated";
}
