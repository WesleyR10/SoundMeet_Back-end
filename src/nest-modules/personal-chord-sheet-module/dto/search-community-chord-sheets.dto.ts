import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

/**
 * Sem `share_scope`: o escopo "community" é FIXO no use-case. Aceitá-lo do
 * cliente permitiria `?share_scope=private` e devolveria os forks privados de
 * todo mundo.
 */
export class SearchCommunityChordSheetsDto {
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
}
