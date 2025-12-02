import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
import { PaymentMethod } from "../../../core/payment/domain/tip.entity";
import { Transform } from "class-transformer";

export class SendTipDto {
  @IsUUID()
  @IsNotEmpty()
  audience_id: string;

  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsUUID()
  @IsOptional()
  event_id?: string;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsNotEmpty()
  payment_method: PaymentMethod;

  @IsOptional()
  pix_key?: { key: string; type: string };

  @IsBoolean()
  @IsOptional()
  is_anonymous?: boolean;

  @IsBoolean()
  @IsOptional()
  show_in_wall?: boolean;
}
