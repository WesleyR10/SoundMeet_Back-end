import { Currency, InvalidMoneyError, Money } from "../money.vo";

describe("Money — construção e invariantes", () => {
  it("recusa valor negativo, não finito e com mais de duas casas", () => {
    expect(() => new Money(-1)).toThrow(InvalidMoneyError);
    expect(() => new Money(Number.NaN)).toThrow(InvalidMoneyError);
    expect(() => new Money(Number.POSITIVE_INFINITY)).toThrow(
      InvalidMoneyError,
    );
    expect(() => new Money(1.234)).toThrow(InvalidMoneyError);
  });

  it("fromCents exige inteiro — meio centavo não existe", () => {
    expect(() => Money.fromCents(10.5)).toThrow(InvalidMoneyError);
    expect(Money.fromCents(1820).amount).toBe(18.2);
  });
});

/*
 * 🔴 A regressão que motivou a correção: em ponto flutuante estas operações
 * não produziam um centavo errado — produziam `InvalidMoneyError`, porque o
 * construtor recusa mais de duas casas. E os valores são os comuns: saldo com
 * centavos é o normal de quem soma gorjetas.
 */
describe("Money — aritmética em centavos", () => {
  it.each([
    [0.1, 0.2, 0.3],
    [1111.1, 11.11, 1122.21],
    [0.07, 0.01, 0.08],
    [19.99, 0.01, 20],
  ])("soma %p + %p = %p sem estourar", (a, b, expected) => {
    expect(new Money(a).add(new Money(b)).amount).toBe(expected);
  });

  it.each([
    [150.3, 110, 40.3],
    [120.7, 110, 10.7],
    [1111.1, 11.11, 1099.99],
    [0.3, 0.1, 0.2],
    [110.05, 110, 0.05],
  ])("subtrai %p - %p = %p sem estourar", (a, b, expected) => {
    expect(new Money(a).subtract(new Money(b)).amount).toBe(expected);
  });

  it("soma e subtração são exatamente reversíveis", () => {
    const start = new Money(150.3);
    const delta = new Money(110);
    expect(start.subtract(delta).add(delta).amount).toBe(150.3);
  });

  it("multiplica arredondando ao centavo — não existe meio centavo", () => {
    expect(new Money(9.9).multiply(3).amount).toBe(29.7);
    // 20 * 9% = 1.80
    expect(new Money(20).multiply(0.09).amount).toBe(1.8);
    // 0.15 arredonda para cima ao centavo mais próximo
    expect(new Money(0.01).multiply(1.5).amount).toBe(0.02);
  });

  it("divide arredondando, e recusa divisor inválido", () => {
    expect(new Money(10).divide(4).amount).toBe(2.5);
    expect(() => new Money(10).divide(0)).toThrow(InvalidMoneyError);
    expect(() => new Money(10).divide(Number.NaN)).toThrow(InvalidMoneyError);
  });

  it("recusa operar entre moedas diferentes", () => {
    const brl = new Money(10, Currency.BRL);
    const usd = new Money(10, Currency.USD);
    expect(() => brl.add(usd)).toThrow(InvalidMoneyError);
    expect(() => brl.subtract(usd)).toThrow(InvalidMoneyError);
  });
});

/*
 * `allocate` existe porque `divide` não sabe repartir: R$10 entre 3 devolveria
 * R$3,33 três vezes e um centavo evaporaria. Num ledger, centavo evaporado é
 * conta que não fecha.
 */
describe("Money — allocate (repartição com soma exata)", () => {
  const sum = (parts: Money[]) =>
    parts.reduce((total, part) => total + part.cents, 0);

  it.each([
    [30, 4, [7.5, 7.5, 7.5, 7.5]],
    [18.2, 2, [9.1, 9.1]],
    [18.2, 3, [6.07, 6.07, 6.06]],
    [10, 3, [3.34, 3.33, 3.33]],
    [45.5, 2, [22.75, 22.75]],
    [0.01, 3, [0.01, 0, 0]],
  ])("reparte %p em %p quotas justas", (amount, parts, expected) => {
    const shares = new Money(amount).allocate(parts as number);
    expect(shares.map((s) => s.amount)).toEqual(expected);
  });

  it.each([
    [30, 4],
    [18.2, 3],
    [10, 3],
    [0.05, 7],
    [999.99, 11],
  ])("a soma das quotas de %p em %p partes é EXATA", (amount, parts) => {
    const original = new Money(amount);
    expect(sum(original.allocate(parts as number))).toBe(original.cents);
  });

  it("nenhuma quota difere de outra por mais de um centavo", () => {
    const shares = new Money(999.99).allocate(7);
    const cents = shares.map((s) => s.cents);
    expect(Math.max(...cents) - Math.min(...cents)).toBeLessThanOrEqual(1);
  });

  it("recusa número de partes inválido", () => {
    expect(() => new Money(10).allocate(0)).toThrow(InvalidMoneyError);
    expect(() => new Money(10).allocate(-1)).toThrow(InvalidMoneyError);
    expect(() => new Money(10).allocate(2.5)).toThrow(InvalidMoneyError);
  });

  it("preserva a moeda em cada quota", () => {
    const shares = new Money(10, Currency.USD).allocate(3);
    expect(shares.every((s) => s.currency === Currency.USD)).toBe(true);
  });
});
