import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, Max, Min } from "class-validator";

import { ListEstablishmentsInput } from "../../../core/establishment/application/use-cases/list-establishments/list-establishments.use-case";
import { EstablishmentFilter } from "../../../core/establishment/domain/establishment.repository";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class SearchEstablishmentsDto implements ListEstablishmentsInput {
  @ApiPropertyOptional({ minimum: 1 })
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @Min(1)
  @Max(100)
  @IsOptional()
  per_page?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sort?: string | null;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsIn(["asc", "desc"])
  @IsOptional()
  sort_dir?: SortDirection | null;

  @ApiPropertyOptional()
  @IsOptional()
  filter?: EstablishmentFilter | null;
}
