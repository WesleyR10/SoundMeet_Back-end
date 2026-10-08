import { ValueObject } from "../value-object";

export enum Currency {
  BRL = "BRL",
  USD = "USD",
  EUR = "EUR",
}

export class Money extends ValueObject {
  readonly amount: number;
  readonly currency: Currency;

  constructor(amount: number, currency: Currency = Currency.BRL) {
    super();
    this.amount = amount;
    this.currency = currency;
    this.validate();
  }

  private validate(): void {
    if (this.amount < 0) {
      throw new InvalidMoneyError("Amount cannot be negative");
    }

    if (!Number.isFinite(this.amount)) {
      throw new InvalidMoneyError("Amount must be a finite number");
    }

    // Validar precisão (máximo 2 casas decimais)
    const decimalPlaces = (this.amount.toString().split(".")[1] || "").length;
    if (decimalPlaces > 2) {
      throw new InvalidMoneyError(
        "Amount cannot have more than 2 decimal places",
      );
    }
  }

  /*
   * ── Toda aritmética abaixo é em CENTAVOS INTEIROS ─────────────────────────
   *
   * 🔴 Não é preciosismo, e a consequência não é imprecisão: é EXCEÇÃO. O
   * construtor recusa mais de duas casas decimais, então `0.1 + 0.2`
   * (`0.30000000000000004`) e `150.30 - 110` (`40.30000000000001`) não produzem
   * um centavo errado — produzem `InvalidMoneyError` e derrubam a operação
   * inteira.
   *
   * E os valores que disparam isso são os comuns, não os exóticos: saldo com
   * centavos é o normal de quem soma gorjetas, e `amount - fee` com qualquer
   * percentual quebrado cai nele. O defeito ficou latente porque este VO nunca
   * teve testes; hoje tem.
   */

  add(other: Money): Money {
    this.assertSameCurrency(other, "add");
    return Money.fromCents(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other, "subtract");
    return Money.fromCents(this.cents - other.cents, this.currency);
  }

  /**
   * Multiplica por um fator adimensional (uma taxa, uma quantidade).
   *
   * O resultado é arredondado ao centavo mais próximo porque não existe meio
   * centavo: `new Money(9.9 * 3)` daria `29.700000000000003` e lançaria. Quem
   * precisa repartir um valor entre N destinatários **não deve** usar
   * `multiply` nem `divide` — use `allocate`, que garante soma exata.
   */
  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new InvalidMoneyError("Factor must be a finite number");
    }
    return Money.fromCents(Math.round(this.cents * factor), this.currency);
  }

  /**
   * Divide por um número, arredondando ao centavo.
   *
   * ⚠️ Serve para "valor por unidade" (cachê por hora), **não** para repartir
   * dinheiro entre pessoas: `R$10 / 3` devolve `R$3,33` três vezes, e R$0,01
   * evapora. Repartição é `allocate`.
   */
  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new InvalidMoneyError("Cannot divide by zero");
    }
    if (!Number.isFinite(divisor)) {
      throw new InvalidMoneyError("Divisor must be a finite number");
    }
    return Money.fromCents(Math.round(this.cents / divisor), this.currency);
  }

  /**
   * Reparte este valor em `parts` quotas cuja soma é EXATAMENTE o original.
   *
   * 🔴 É a operação que dividir não sabe fazer. `Math.floor(net / n)` sobre
   * reais — como o split de gorjeta de banda fazia — trata centavos como resto
   * descartável: R$30 entre 4 virava R$9 para o líder e R$7 para cada um dos
   * outros, quando o justo é R$7,50. E R$18,20 entre 3 produzia
   * `6.199999999999999`, que o construtor recusa: a confirmação da gorjeta
   * falhava inteira, com o pagamento já aprovado no gateway.
   *
   * O algoritmo é o clássico: divide em centavos e distribui o resto, um
   * centavo por quota, a partir da primeira. A diferença entre a maior e a
   * menor quota nunca passa de um centavo, e a soma fecha por construção — que
   * é o que um ledger precisa no fim do mês.
   */
  allocate(parts: number): Money[] {
    if (!Number.isInteger(parts) || parts <= 0) {
      throw new InvalidMoneyError("Parts must be a positive integer");
    }

    const base = Math.trunc(this.cents / parts);
    const remainder = this.cents - base * parts;

    return Array.from({ length: parts }, (_, index) =>
      Money.fromCents(index < remainder ? base + 1 : base, this.currency),
    );
  }

  private assertSameCurrency(other: Money, operation: string): void {
    if (this.currency !== other.currency) {
      throw new InvalidMoneyError(
        `Cannot ${operation} money with different currencies`,
      );
    }
  }

  isGreaterThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new InvalidMoneyError(
        "Cannot compare money with different currencies",
      );
    }
    return this.amount > other.amount;
  }

  isLessThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new InvalidMoneyError(
        "Cannot compare money with different currencies",
      );
    }
    return this.amount < other.amount;
  }

  isEqual(other: Money): boolean {
    return this.currency === other.currency && this.amount === other.amount;
  }

  get formatted(): string {
    switch (this.currency) {
      case Currency.BRL:
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(this.amount);
      case Currency.USD:
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(this.amount);
      case Currency.EUR:
        return new Intl.NumberFormat("de-DE", {
          style: "currency",
          currency: "EUR",
        }).format(this.amount);
      default:
        return `${this.amount} ${this.currency}`;
    }
  }

  get cents(): number {
    return Math.round(this.amount * 100);
  }

  /**
   * O construtor canônico de toda aritmética desta classe.
   *
   * `cents / 100` só é seguro porque `cents` é inteiro: a divisão por 100 de um
   * inteiro sempre cai numa representação com no máximo duas casas decimais, e
   * é justamente essa a invariante que o construtor exige.
   */
  static fromCents(cents: number, currency: Currency = Currency.BRL): Money {
    if (!Number.isInteger(cents)) {
      throw new InvalidMoneyError("Cents must be an integer");
    }
    return new Money(cents / 100, currency);
  }

  static zero(currency: Currency = Currency.BRL): Money {
    return new Money(0, currency);
  }

  toJSON() {
    return {
      amount: this.amount,
      currency: this.currency,
      formatted: this.formatted,
      cents: this.cents,
    };
  }
}

export class InvalidMoneyError extends Error {
  constructor(message?: string) {
    super(message || "Invalid money value");
    this.name = "InvalidMoneyError";
  }
}
