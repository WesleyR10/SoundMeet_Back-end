import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

import { PaymentMethod } from "../../../core/payment/domain/tip-enums";

export class PixKeyDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsString()
  type: string;
}

export class SendTipDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  audience_id: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  musician_id?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  band_id?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  event_id?: string;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.PIX })
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod = PaymentMethod.PIX;

  @ApiPropertyOptional({ type: PixKeyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PixKeyDto)
  pix_key?: PixKeyDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  show_in_wall?: boolean;
}
