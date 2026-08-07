import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

import { ListInquiriesInput } from "../../../core/scheduling/application/use-cases/list-inquiries/list-inquiries.use-case";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

/** Ver `SearchBookingsDto` — escopo vem do JWT, nunca da query. */
export class SearchInquiriesDto implements ListInquiriesInput {
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

  @ApiPropertyOptional({ description: "Refinar por estabelecimento (UUID)" })
  @IsUUID()
  @IsOptional()
  establishment_id?: string | null;

  @ApiPropertyOptional({ description: "Refinar por músico (UUID)" })
  @IsUUID()
  @IsOptional()
  musician_id?: string | null;

  @ApiPropertyOptional({ description: "Refinar por banda (UUID)" })
  @IsUUID()
  @IsOptional()
  band_id?: string | null;

  @ApiPropertyOptional({ description: "Refinar por evento (UUID)" })
  @IsUUID()
  @IsOptional()
  event_id?: string | null;

  @ApiPropertyOptional({
    description: "open | accepted | rejected | expired | converted",
  })
  @IsString()
  @IsOptional()
  status?: string | null;

  @ApiPropertyOptional({ description: "Criada a partir de (ISO 8601)" })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  created_at_gte?: Date | null;

  @ApiPropertyOptional({ description: "Criada até (ISO 8601)" })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  created_at_lte?: Date | null;
}
