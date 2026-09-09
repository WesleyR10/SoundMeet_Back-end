import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class SearchRepertoiresDto {
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

  @ApiPropertyOptional({ enum: ["name", "created_at"] })
  @IsOptional()
  @IsIn(["name", "created_at"])
  sort?: string | null;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sort_dir?: "asc" | "desc" | null;

  @ApiPropertyOptional({ description: "Filtrar por nome do repertório" })
  @IsOptional()
  @IsString()
  name?: string | null;
}
