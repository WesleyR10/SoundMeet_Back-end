import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/**
 * Busca do fã no catálogo. `musician_id` vem do PATH — e `scope` não existe
 * aqui de propósito: quem decide onde a busca acontece é o músico, lido no
 * servidor. Aceitar o escopo pela query devolveria ao cliente exatamente o
 * limite que desligar o switch existe para impor.
 */
export class SearchSongCatalogDto {
  @ApiPropertyOptional({
    description: "Texto livre — casa com título OU artista.",
  })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  term?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}
