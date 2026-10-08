import { Money } from "../../shared/domain/value-objects/money.vo";

/**
 * Divide um valor bruto em comissão da plataforma + líquido do beneficiário,
 * em **CENTAVOS INTEIROS**.
 *
 * 🔴 `amount.subtract(fee)` em ponto flutuante produz `1111.1000000000001`, e o
 * `Money` recusa mais de duas casas — o agregado nasce inválido para uma
 * combinação perfeitamente comum de valor e percentual. É a mesma classe de
 * erro que já derrubou dois fake builders deste módulo.
 *
 * Trabalhar em centavos também garante a invariante que importa de verdade:
 * `platform_fee + net_amount === amount`, **exatamente**. Um centavo perdido no
 * arredondamento é um centavo que ninguém recebe — e num ledger financeiro isso
 * não fecha no fim do mês.
 *
 * Serve os dois vértices: a comissão da gorjeta (9/7/5%) e a do cachê.
 */
export function splitAmountInCents(
  amount: number,
  feePercentage: number,
): { amount: Money; platform_fee: Money; net_amount: Money } {
  const totalCents = Math.round(amount * 100);
  const feeCents = Math.round((totalCents * feePercentage) / 100);

  return {
    amount: new Money(totalCents / 100),
    platform_fee: new Money(feeCents / 100),
    net_amount: new Money((totalCents - feeCents) / 100),
  };
}
