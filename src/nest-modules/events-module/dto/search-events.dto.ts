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

  /**
   * ⚠️ Nome da COLUNA do Prisma, não do domínio — é o que
   * `EventPrismaRepository.sortableFields` aceita (`["startTime",
   * "created_at", "name"]`). Campo fora da lista lança `InvalidArgumentError`
   * e vira 422; não há fallback silencioso.
   *
   * O enum anterior anunciava `start_at` e `updated_at`, que **não existem**
   * na lista — quem seguisse o Swagger tomava 422 (verificado por HTTP em
   * 08/ago/2026). Este DTO serve às três listagens do módulo, e cada
   * repositório tem a sua lista; as outras duas estão citadas abaixo para não
   * ser preciso caçá-las:
   *   - attendees  → ["joinedAt", "leftAt"]
   *   - performers → ["created_at", "status", "fee"]
   */
  @ApiPropertyOptional({
    description:
      "Campo de ordenação. Eventos: name | startTime | created_at. " +
      "Attendees: joinedAt | leftAt. Performers: created_at | status | fee.",
    enum: ["name", "startTime", "created_at"],
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
