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

import { ListBookingsInput } from "../../../core/scheduling/application/use-cases/list-bookings/list-bookings.use-case";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

/**
 * Só campos de REFINO. O escopo (quais reservas o usuário pode ver) é derivado
 * do JWT no controller e nunca aceito por query — por isso
 * `requesting_participant_ids`/`is_admin` não aparecem aqui.
 */
export class SearchBookingsDto implements ListBookingsInput {
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
    description: "pending | confirmed | cancelled | expired | completed",
  })
  @IsString()
  @IsOptional()
  status?: string | null;

  // @Type(() => Date) é obrigatório: o ValidationPipe global NÃO usa
  // enableImplicitConversion, então sem isso a query string chegaria como
  // string e @IsDate rejeitaria tudo com 422 — foi exatamente o bug do
  // GET /gamification/leaderboard (roadmap 7.17).
  @ApiPropertyOptional({ description: "Início a partir de (ISO 8601)" })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  start_at_gte?: Date | null;

  @ApiPropertyOptional({ description: "Início até (ISO 8601)" })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  start_at_lte?: Date | null;
}
