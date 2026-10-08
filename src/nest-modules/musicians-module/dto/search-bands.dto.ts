import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { ListBandsInput } from "../../../core/musician/application/use-cases/list-bands/list-bands.input";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";
import { Currency } from "../../../core/shared/domain/value-objects/money.vo";
import { PriceModel } from "../../../core/shared/domain/value-objects/price-range.vo";

/** Teto do `qs`: acima de 20 itens ele devolve OBJETO em vez de lista. */
const MAX_LIST_ITEMS = 20;

/** `filter[genres]=MPB` (sem colchete) chega como texto; vira lista de um. */
const toList = ({ value }: { value: unknown }) =>
  typeof value === "string" ? [value] : value;

/**
 * O filtro que a busca PÚBLICA de bandas aceita.
 *
 * Par de `SearchMusiciansFilterDto` — mesma razão de existir, mesmos quatro
 * defeitos, confirmados por HTTP em 08/out/2026, todos com resposta 200 (ou
 * 500) e nenhum erro que apontasse a causa:
 *
 * 1. **Nada era convertido.** Query string é texto: `price_min`/`price_max`
 *    chegavam como `"800"`, o setter exigia número e os descartava. O filtro
 *    de preço da aba Bandas do painel nunca filtrou —
 *    `filter[price_min]=999999` devolvia todas.
 * 2. **Nada era validado.** `filter[genres]=MPB` (texto, não lista) ia direto
 *    ao `hasSome` do Prisma e a busca respondia 500.
 * 3. **Chave desconhecida era aceita calada** (`filter[banana]=1`), enquanto a
 *    mesma chave no topo da query dá 422.
 * 4. **O filtro interno ficava alcançável por HTTP.** `musician_id` listava as
 *    bandas de qualquer músico mesmo fora do radar, contornando o opt-in do
 *    líder; `is_active` e `open_to_gigs` são de uso dos use-cases.
 *
 * Esta classe é a allowlist do que a rota aceita. Campo novo em `BandFilter`
 * NÃO vira filtro público por herança.
 */
export class SearchBandsFilterDto {
  @ApiPropertyOptional({ description: "Parte do nome da banda." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ type: [String], maxItems: MAX_LIST_ITEMS })
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayMaxSize(MAX_LIST_ITEMS)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  genres?: string[];

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

  /*
   * O trio geográfico só FILTRA completo (`lat` + `lng` + `radius_km`); o
   * setter de `BandSearchParams` ignora um par solto. Cada campo é validado
   * sozinho de propósito — mesma decisão do filtro de músicos.
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

export class SearchBandsDto implements ListBandsInput {
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

  @ApiPropertyOptional({ type: () => SearchBandsFilterDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SearchBandsFilterDto)
  filter?: SearchBandsFilterDto | null;
}
