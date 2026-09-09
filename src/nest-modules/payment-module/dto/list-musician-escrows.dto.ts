import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

import { BookingEscrowStatus } from "../../../core/payment/domain/booking-escrow-enums";

/**
 * Só campos de REFINO. O escopo (de quem são as custódias) vem do `:id` da rota,
 * protegido pelo `MusicianOwnershipGuard`, e é reaplicado no use-case por cima
 * deste filtro — por isso `musician_id` não existe aqui.
 */
export class ListMusicianEscrowsDto {
  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  per_page?: number = 15;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sort?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsEnum(["asc", "desc"])
  @IsOptional()
  sort_dir?: "asc" | "desc";

  @ApiPropertyOptional({ enum: BookingEscrowStatus })
  @IsEnum(BookingEscrowStatus)
  @IsOptional()
  status?: BookingEscrowStatus;

  /**
   * Refina para a custódia de UM show.
   *
   * É o que permite ao app mostrar, na tela do contrato, quanto a plataforma
   * retém daquele cachê **antes** do aceite — a informação que a cláusula de
   * pagamento pressupõe ter sido dada às partes. Continua dentro do escopo do
   * músico da rota: refinar não amplia.
   */
  @ApiPropertyOptional({ format: "uuid" })
  @IsUUID()
  @IsOptional()
  booking_id?: string;
}
