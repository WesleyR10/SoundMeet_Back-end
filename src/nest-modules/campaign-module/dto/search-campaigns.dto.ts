import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

import { ListCampaignsInput } from "../../../core/campaign/application/use-cases/list-campaigns/list-campaigns.use-case";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class SearchCampaignsDto implements ListCampaignsInput {
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
  @IsString()
  @IsOptional()
  search?: string | null;

  @ApiPropertyOptional({ description: "Filtrar por estabelecimento (UUID)" })
  @IsUUID()
  @IsOptional()
  establishment_id?: string | null;

  @ApiPropertyOptional({
    description: "Filtrar por status (draft, active, sent, cancelled)",
  })
  @IsString()
  @IsOptional()
  status?: string | null;
}
