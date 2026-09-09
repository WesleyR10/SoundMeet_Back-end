import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, Max, Min } from "class-validator";

import { RecommendMusiciansInput } from "../../../core/audience/application/use-cases/recommend-musicians/recommend-musicians.input";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

/**
 * 🔴 Este DTO não tinha UM decorator de validação — e `implements` é a razão.
 *
 * `implements Omit<RecommendMusiciansInput, "audience_id">` é contrato de TIPO:
 * some na compilação e não carrega metadata nenhuma para o runtime. Só `extends`
 * de classe herda validação. O `RecommendMusiciansQueryInput` do core tem os
 * `@IsOptional()` certinhos — mas ninguém os herdava aqui.
 *
 * O estrago tinha duas fases, e a primeira durou muito mais:
 *
 * 1. **Antes do INP-1** (`whitelist: true` sozinho): as cinco propriedades eram
 *    removidas da query **em silêncio**. `query.page`, `query.per_page` e
 *    `query.only_active` chegavam ao handler como `undefined` em TODA
 *    requisição. Ou seja, a paginação desta rota nunca funcionou e o
 *    `only_active=true` que o app manda nunca filtrou nada — o carrossel
 *    "Pra você" podia recomendar músico inativo. Sintoma zero: 200, lista
 *    plausível, nada no log. É o mesmo padrão do 9.7 ("a tela diz salvo sem ter
 *    salvo").
 * 2. **Depois do INP-1** (`forbidNonWhitelisted: true`): o descarte virou
 *    **422**, e como `useRecommendedMusicians` manda `page`, `per_page` e
 *    `only_active` em toda chamada, o carrossel da Home do fã parou de carregar.
 *
 * Com os decorators, os dois somem de uma vez: o corpo volta a ser aceito E os
 * parâmetros passam a de fato chegar ao use case.
 *
 * Padrão copiado de `search-musicians.dto.ts` (números) e `search-reviews.dto.ts`
 * (o `Transform` do booleano — query string entrega `"true"`, e sem ele o
 * `@IsBoolean` reprovaria o valor legítimo).
 */
export class RecommendMusiciansDto implements Omit<
  RecommendMusiciansInput,
  "audience_id"
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

  @ApiPropertyOptional({ enum: ["rating", "created_at"] })
  @IsIn(["rating", "created_at"])
  @IsOptional()
  sort?: "rating" | "created_at";

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsIn(["asc", "desc"])
  @IsOptional()
  sort_dir?: SortDirection | null;

  @ApiPropertyOptional({ description: "Apenas músicos ativos" })
  @Transform(({ value }) =>
    value === undefined ? undefined : value === "true" || value === true,
  )
  @IsBoolean()
  @IsOptional()
  only_active?: boolean;
}
