import { IsNotEmpty, IsNumber, IsObject, IsUUID } from "class-validator";
import { Transform } from "class-transformer";

export class WithdrawToPixDto {
  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @IsObject()
  @IsNotEmpty()
  pix_key: { key: string; type: string };
}
