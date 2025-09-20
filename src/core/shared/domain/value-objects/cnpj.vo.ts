import { ValueObject } from "../value-object";

export class CNPJ extends ValueObject {
  readonly value: string;

  constructor(value: string) {
    super();
    this.value = this.cleanCNPJ(value);
    this.validate();
  }

  private cleanCNPJ(cnpj: string): string {
    return cnpj.replace(/\D/g, "");
  }

  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new InvalidCNPJError("CNPJ cannot be empty");
    }

    if (this.value.length !== 14) {
      throw new InvalidCNPJError("CNPJ must have 14 digits");
    }

    if (/^(\d)\1{13}$/.test(this.value)) {
      throw new InvalidCNPJError(
        "CNPJ cannot be a sequence of repeated digits",
      );
    }

    if (!this.isValidCNPJ(this.value)) {
      throw new InvalidCNPJError("Invalid CNPJ");
    }
  }

  private isValidCNPJ(cnpj: string): boolean {
    const numbers = cnpj.split("").map(Number);

    // Calculate first check digit
    let sum = 0;
    let weight = 5;
    for (let i = 0; i < 12; i++) {
      sum += numbers[i] * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }

    const firstDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (firstDigit !== numbers[12]) {
      return false;
    }

    // Calculate second check digit
    sum = 0;
    weight = 6;
    for (let i = 0; i < 13; i++) {
      sum += numbers[i] * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }

    const secondDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return secondDigit === numbers[13];
  }

  get formatted(): string {
    return this.value.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5",
    );
  }

  get root(): string {
    return this.value.substring(0, 8);
  }

  get branch(): string {
    return this.value.substring(8, 12);
  }

  get checkDigits(): string {
    return this.value.substring(12, 14);
  }

  toString(): string {
    return this.value;
  }

  toJSON() {
    return {
      value: this.value,
      formatted: this.formatted,
      root: this.root,
      branch: this.branch,
      check_digits: this.checkDigits,
    };
  }
}

export class InvalidCNPJError extends Error {
  constructor(message?: string) {
    super(message || "Invalid CNPJ");
    this.name = "InvalidCNPJError";
  }
}
