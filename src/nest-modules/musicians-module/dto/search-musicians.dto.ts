import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { ListMusiciansInput } from "../../../core/musician/application/use-cases/list-musicians/list-musicians.input";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";
import { Currency } from "../../../core/shared/domain/value-objects/money.vo";
import { PriceModel } from "../../../core/shared/domain/value-objects/price-range.vo";

/** Teto do `qs`: acima de 20 itens ele devolve OBJETO em vez de lista. */
const MAX_LIST_ITEMS = 20;

/** `filter[genres]=MPB` (sem colchete) chega como texto; vira lista de um. */
const toList = ({ value }: { value: unknown }) =>
  typeof value === "string" ? [value] : value;

/** `"true"`/`"false"` viram booleano; o resto segue cru para o validador recusar. */
const toBoolean = ({ value }: { value: unknown }) =>
  value === "true" ? true : value === "false" ? false : value;

/**
 * O filtro que a busca PÚBLICA de músicos aceita.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE É UMA CLASSE, E NÃO O `MusicianFilter` DO DOMÍNIO
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Até out/2026 este campo era `filter?: MusicianFilter` com um `@IsOptional()`
 * e mais nada — o tipo do domínio exposto cru na borda. Quatro defeitos saíram
 * daí, todos com HTTP 200 e nenhum erro:
 *
 * 1. **Nada era convertido.** Query string é texto: `price_min` e `price_max`
 *    chegavam como `"100"`, o setter exigia número e os descartava. O filtro de
 *    preço da grade de artistas nunca filtrou.
 * 2. **Nada era validado.** `filter[genres]=MPB` (texto, não lista) ia direto
 *    ao `hasSome` do Prisma e a busca respondia 500.
 * 3. **Chave desconhecida era aceita calada**, enquanto a mesma chave no topo
 *    da query dá 422 (`forbidNonWhitelisted`). O alarme existia para metade do
 *    objeto.
 * 4. **O filtro interno ficava alcançável por HTTP.** `email` permitia
 *    reconstruir o e-mail de qualquer artista; `ids`, `is_active` e
 *    `open_to_gigs` são de uso dos use-cases, não de quem navega.
 *
 * Esta classe é a allowlist do que a rota aceita. Campo novo em
 * `MusicianFilter` NÃO vira filtro público por herança: só entra se for
 * declarado aqui, com a sua validação.
 */
export class SearchMusiciansFilterDto {
  @ApiPropertyOptional({
    description: "Busca pelo nome exibido: nome artístico OU nome de cadastro.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: "Só o nome de cadastro." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: "Só o nome artístico." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  stage_name?: string;

  @ApiPropertyOptional({ type: [String], maxItems: MAX_LIST_ITEMS })
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayMaxSize(MAX_LIST_ITEMS)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  genres?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: MAX_LIST_ITEMS })
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayMaxSize(MAX_LIST_ITEMS)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  instruments?: string[];

  @ApiPropertyOptional({ enum: ["per_event", "per_hour"] })
  @IsOptional()
  @IsIn(["per_event", "per_hour"])
  price_model?: PriceModel;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  price_min?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  price_max?: number;

  @ApiPropertyOptional({ enum: Object.values(Currency) })
  @IsOptional()
  @IsIn(Object.values(Currency))
  price_currency?: Currency;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  is_verified?: boolean;

  /*
   * O trio geográfico só FILTRA completo (`lat` + `lng` + `radius_km`); o
   * setter de `MusicianSearchParams` ignora um par solto. Cada campo é
   * validado sozinho de propósito: recusar com 422 um par válido que só não
   * tem efeito quebraria a tela de quem chama para punir um parâmetro inócuo.
   */
  @ApiPropertyOptional({ minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({
    minimum: 0,
    description: "Em km. Acima de 500 é reduzido a 500.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  radius_km?: number;
}

export class SearchMusiciansDto implements ListMusiciansInput {
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

  @ApiPropertyOptional({ type: () => SearchMusiciansFilterDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SearchMusiciansFilterDto)
  filter?: SearchMusiciansFilterDto | null;
}
