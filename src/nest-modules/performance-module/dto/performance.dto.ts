import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  MinLength,
} from "class-validator";

import {
  NIGHT_PERIOD_DAYS,
  type NightPeriodDays,
} from "../../../core/performance/application/use-cases/get-musician-nights/get-musician-nights.use-case";

export class StartPerformanceDto {
  @ApiProperty({
    format: "uuid",
    description: "Evento em que o músico está escalado.",
  })
  @IsUUID("4")
  event_id: string;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Banda em nome de quem se toca. Quem opera o set continua sendo o músico autenticado.",
  })
  @IsOptional()
  @IsUUID("4")
  band_id?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Setlist da noite: um repertório do PRÓPRIO músico. Ausente = improviso.",
  })
  @IsOptional()
  @IsUUID("4")
  repertoire_id?: string;
}

/**
 * Trocar a setlist com o set no ar. `null` remove (segue no improviso).
 *
 * `@ValidateIf` em vez de `@IsOptional`: o campo é OBRIGATÓRIO no corpo — um
 * PATCH vazio não pode ser lido como "remover a setlist" por omissão.
 */
export class ChangePerformanceSetlistDto {
  @ApiProperty({ format: "uuid", nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsUUID("4")
  repertoire_id: string | null;
}

/**
 * Três formas de dizer qual é a música, em ordem de precedência:
 * `music_library_id` > `request_id` > `title`+`artist`.
 *
 * O DTO não força "exatamente uma": o use-case resolve pela precedência e é
 * ele que valida o vínculo (a música é da sua biblioteca? o pedido é deste
 * evento?). Espalhar essa regra aqui a duplicaria num lugar sem acesso ao
 * banco — e o DTO só saberia dizer "escolha um", não "este não é seu".
 */
export class StartSongDto {
  @ApiPropertyOptional({
    format: "uuid",
    description: "Música da biblioteca do próprio músico.",
  })
  @IsOptional()
  @IsUUID("4")
  music_library_id?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Pedido do público que esta execução atende.",
  })
  @IsOptional()
  @IsUUID("4")
  request_id?: string;

  @ApiPropertyOptional({
    description: "Título, quando a música não vem da biblioteca nem de pedido.",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: "Artista.", maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  artist?: string;
}

export class GetLivePerformanceQueryDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  musician_id: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  event_id: string;
}

export class ListPerformancesQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("4")
  establishment_id?: string;

  @ApiPropertyOptional({ enum: ["live", "ended"] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  per_page?: number;
}

export class SuggestSetlistQueryDto {
  @ApiProperty({
    format: "uuid",
    description: "O local para o qual as sugestões são calculadas.",
  })
  @IsUUID("4")
  establishment_id: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;
}

const toNumber = ({ value }: { value: unknown }) =>
  value === undefined || value === "" ? undefined : Number(value);

/**
 * `GET /events/live-now` e `GET /events/up-next`.
 *
 * `lat` + `lng` dão distância e ordem por proximidade SEM cortar nada;
 * `radius_km` junto passa a filtrar. O app manda só o par: um raio que não
 * pega palco nenhum deixaria a Home vazia numa noite com show a 60 km. Trio
 * incompleto é ignorado, não recusado — o cartaz sai sem distância.
 */
export class ListStagesQueryDto {
  @ApiPropertyOptional({ description: "Latitude do fã." })
  @Transform(toNumber)
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ description: "Longitude do fã." })
  @Transform(toNumber)
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 500 })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  radius_km?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 10 })
  @Transform(toNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

/**
 * `GET /musicians/:id/analytics/nights` — o período do master do Analytics.
 *
 * Só os três períodos da tela: um `days=45` não tem aba que o mostre, e
 * aceitá-lo faria a API responder uma pergunta que ninguém fez.
 */
export class MusicianNightsQueryDto {
  @ApiPropertyOptional({ enum: NIGHT_PERIOD_DAYS, default: 30 })
  @IsOptional()
  @Transform(toNumber)
  @IsIn(NIGHT_PERIOD_DAYS as unknown as number[])
  days?: NightPeriodDays;
}
