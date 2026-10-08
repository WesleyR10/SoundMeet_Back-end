import { splitAmountInCents } from "../split-amount";

/**
 * A divisão bruto → comissão + líquido.
 *
 * Serve os dois vértices (gorjeta e cachê) e existe porque
 * `amount.subtract(fee)` em ponto flutuante devolve `1111.1000000000001`, que o
 * `Money` recusa — fazendo o agregado nascer inválido para combinações
 * perfeitamente comuns.
 */
describe("splitAmountInCents", () => {
  it("fecha a conta EXATAMENTE: comissão + líquido === bruto", () => {
    // Centavo perdido em arredondamento é centavo que ninguém recebe.
    const casos: [number, number][] = [
      [1500, 10],
      [333.33, 9],
      [5, 9],
      [19.99, 7],
      [1234.56, 10],
      [0.99, 5],
      [4999.95, 7],
    ];

    for (const [amount, pct] of casos) {
      const split = splitAmountInCents(amount, pct);
      expect(split.platform_fee.amount + split.net_amount.amount).toBeCloseTo(
        split.amount.amount,
        10,
      );
    }
  });

  it("nunca produz Money com mais de 2 casas", () => {
    // 9% de R$333,33 = 29,999700000000004 em ponto flutuante.
    const split = splitAmountInCents(333.33, 9);

    expect(split.platform_fee.amount).toBe(30);
    expect(split.net_amount.amount).toBe(303.33);
    expect(
      String(split.net_amount.amount).split(".")[1]?.length ?? 0,
    ).toBeLessThanOrEqual(2);
  });

  it("comissão de 0% deixa o líquido igual ao bruto", () => {
    const split = splitAmountInCents(50, 0);

    expect(split.platform_fee.amount).toBe(0);
    expect(split.net_amount.amount).toBe(50);
  });

  it("arredonda a comissão a centavo, sem estourar o valor", () => {
    // 9% de R$5 = R$0,45 exato; 7% de R$19,99 = 1,3993 → R$1,40.
    expect(splitAmountInCents(5, 9).platform_fee.amount).toBe(0.45);
    expect(splitAmountInCents(19.99, 7).platform_fee.amount).toBe(1.4);
    expect(splitAmountInCents(19.99, 7).net_amount.amount).toBe(18.59);
  });
});
