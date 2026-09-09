import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

import { BillingCycle } from "../../../core/plans/domain/plan-tier.enum";

export class CreateSubscriptionCheckoutDto {
  @ApiProperty({
    description:
      "Tier pago do plano (musician: essential|pro; establishment: growth|pro)",
    example: "essential",
  })
  @IsString()
  @IsNotEmpty()
  plan_tier: string;

  @ApiProperty({ enum: BillingCycle, example: BillingCycle.MONTHLY })
  @IsEnum(BillingCycle)
  billing_cycle: BillingCycle;

  @ApiProperty({
    description: "Nome completo do pagador",
    example: "João da Silva",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  payer_name: string;

  @ApiProperty({ description: "E-mail do pagador", example: "joao@email.com" })
  @IsEmail()
  payer_email: string;

  @ApiProperty({
    description: "CPF ou CNPJ do pagador (com ou sem máscara)",
    example: "123.456.789-09",
  })
  @IsString()
  @Matches(/^[\d.\-/]{11,18}$/, {
    message: "payer_cpf_cnpj deve ser um CPF ou CNPJ válido",
  })
  payer_cpf_cnpj: string;
}
