import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { REVIEW_CONTEXT_TYPES } from "../../../core/review/domain/review-types";

/**
 * O DTO NÃO recebe autor: `author_id`/`author_type` são derivados do JWT no
 * controller. Aceitá-los pelo corpo permitiria avaliar em nome de terceiros.
 */
export class SubmitReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @Max(5)
  @Min(1)
  @IsInt()
  rating: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @MaxLength(1000)
  @IsOptional()
  @IsString()
  comment?: string | null;

  @ApiProperty({
    enum: REVIEW_CONTEXT_TYPES,
    description:
      "Prova do encontro: 'event' (fã que esteve presente) ou 'booking' (show concluído entre músico e estabelecimento).",
  })
  @IsIn(REVIEW_CONTEXT_TYPES as unknown as string[])
  context_type: "event" | "booking";

  @ApiProperty({ format: "uuid", description: "UUID do evento ou da reserva" })
  @IsUUID()
  @IsNotEmpty()
  context_id: string;

  /**
   * Só faz sentido quando um ESTABELECIMENTO avalia um músico e a conta opera
   * mais de uma unidade (multi-estabelecimento, até 3 no PRO). O valor é
   * sempre conferido contra o claim `establishment_ids` do token — informar um
   * id alheio dá 403, não é atalho de autorização.
   */
  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Qual estabelecimento assina a avaliação (obrigatório se a conta opera mais de um).",
  })
  @IsUUID()
  @IsOptional()
  author_establishment_id?: string;
}
