import { IsNotEmpty, IsUUID } from "class-validator";

export class ConfirmTipPaymentDto {
  @IsUUID()
  @IsNotEmpty()
  tip_id: string;
}
