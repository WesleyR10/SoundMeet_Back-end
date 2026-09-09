import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

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
