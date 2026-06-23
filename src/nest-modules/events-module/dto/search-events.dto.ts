import { EventFilter } from "@core/events/domain";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, Max, Min } from "class-validator";

import { ListEventsInput } from "../../../core/events/application/use-cases/list-events/list-events.use-case";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class SearchEventsDto implements Omit<
  ListEventsInput,
  "establishment_id"
> {
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

  @ApiPropertyOptional({
    enum: ["name", "startTime", "start_at", "created_at", "updated_at"],
  })
  @IsString()
  @IsOptional()
  sort?: string | null;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsIn(["asc", "desc"])
  @IsOptional()
  sort_dir?: SortDirection | null;

  @ApiPropertyOptional()
  @IsOptional()
  filter?: Omit<EventFilter, "establishment_id"> | null;
}
