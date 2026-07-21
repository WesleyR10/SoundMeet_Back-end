import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import { PriceModel } from "../../../../shared/domain/value-objects/price-range.vo";

// Input fortemente tipado e validado (class-validator) para uma faixa de
// preço — compartilhado pelos use cases de musician que aceitam priceRanges.
// Espelha o VO PriceRange; a validação de domínio (min<=max, 2 casas
// decimais, modelos únicos) continua no VO/agregado.
export class PriceRangeInput {
  @IsIn(["per_event", "per_hour"])
  model: PriceModel;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  min: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  max: number;

  @IsOptional()
  @IsIn(Object.values(Currency))
  currency?: Currency;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
