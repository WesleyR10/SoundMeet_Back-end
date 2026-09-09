import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Min } from "class-validator";

/**
 * O saque NÃO recebe a chave de destino: ela é sempre a que está cadastrada na
 * carteira (`GET/PATCH .../wallet/pix-key`). Aceitar o destino aqui deixava um
 * token comprometido drenar o saldo num único POST. Ver
 * `Docs/audits/security-review-2026-08-28.md` (A1).
 */
export class WithdrawToPixDto {
  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;
}
