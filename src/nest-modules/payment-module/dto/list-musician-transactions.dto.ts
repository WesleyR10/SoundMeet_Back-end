import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

import {
  TransactionStatus,
  TransactionType,
} from "../../../core/payment/domain/transaction-enums";

// Espelha ListMusicianTipsDto — mesma paginação/ordenação, com filtro por
// `type` além do `status` (o extrato mistura gorjeta e saque, então filtrar por
// tipo é o recorte mais útil da tela de carteira).
export class ListMusicianTransactionsDto {
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

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @ApiPropertyOptional({ enum: TransactionType })
  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;
}
