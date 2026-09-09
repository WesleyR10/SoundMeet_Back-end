import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Min } from "class-validator";

import { INDICATION_STATUSES } from "../../../core/indication/domain/indication-types";
import { IndicationStatus } from "../../../core/indication/domain/indication-types";

/**
 * ⚠️ `establishment_id` NÃO entra aqui: vem do path, conferido pelo
 * `EstablishmentOwnershipGuard`. Aceitá-lo por query permitiria ler a caixa de
 * indicações de outro estabelecimento.
 *
 * ⚠️ Todo campo precisa de decorator: com `forbidNonWhitelisted` ligado, uma
 * propriedade sem validação é 422 sob SWC (que emite `void 0` para declarações
 * sem inicializador) — e, pior, era descartada em silêncio antes disso. Foi
 * exatamente o que quebrou `RecommendMusiciansDto`.
 */
export class ListIndicationsDto {
  @ApiPropertyOptional({ enum: INDICATION_STATUSES })
  @IsIn(INDICATION_STATUSES as unknown as string[])
  @IsOptional()
  status?: IndicationStatus;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Min(1)
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ minimum: 1, default: 15 })
  @Min(1)
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  per_page?: number;
}
