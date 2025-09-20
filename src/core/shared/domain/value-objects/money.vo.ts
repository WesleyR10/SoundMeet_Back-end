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

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new InvalidMoneyError("Cannot add money with different currencies");
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new InvalidMoneyError(
        "Cannot subtract money with different currencies",
      );
    }
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new InvalidMoneyError("Cannot divide by zero");
    }
    return new Money(this.amount / divisor, this.currency);
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

  static fromCents(cents: number, currency: Currency = Currency.BRL): Money {
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
