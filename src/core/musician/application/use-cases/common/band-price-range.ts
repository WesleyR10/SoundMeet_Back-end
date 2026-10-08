import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  InvalidPriceRangeError,
  PriceRange,
  PriceRangeProps,
} from "../../../../shared/domain/value-objects/price-range.vo";

/**
 * Faixa de preço da banda a partir do corpo da requisição.
 *
 * `InvalidPriceRangeError` é `Error` puro: sem esta tradução, uma faixa com
 * mínimo acima do máximo passava pelo DTO (cada número é válido sozinho) e
 * virava 500 no `GlobalExceptionFilter`, em vez de um 422 que o app sabe ler.
 */
export function toBandPriceRange(props: PriceRangeProps): PriceRange {
  try {
    return new PriceRange(props);
  } catch (error) {
    if (error instanceof InvalidPriceRangeError) {
      throw new EntityValidationError([{ priceRange: [error.message] }]);
    }
    throw error;
  }
}
