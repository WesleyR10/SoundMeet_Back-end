import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsUUID,
  Min,
} from "class-validator";

import { PaymentMethod } from "../../../core/payment/domain/tip-enums";

export class ConfirmTipPaymentDto {
  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fee?: number;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.PIX })
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod = PaymentMethod.PIX;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  user_id?: string | null;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;
}
