import { ValueObject } from "../value-object";

export class CPF extends ValueObject {
  readonly value: string;

  constructor(value: string) {
    super();
    this.value = this.cleanCPF(value);
    this.validate();
  }

  private cleanCPF(cpf: string): string {
    return cpf.replace(/\D/g, "");
  }

  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new InvalidCPFError("CPF cannot be empty");
    }

    if (this.value.length !== 11) {
      throw new InvalidCPFError("CPF must have 11 digits");
    }

    if (/^(\d)\1{10}$/.test(this.value)) {
      throw new InvalidCPFError("CPF cannot be a sequence of repeated digits");
    }

    if (!this.isValidCPF(this.value)) {
      throw new InvalidCPFError("Invalid CPF");
    }
  }

  private isValidCPF(cpf: string): boolean {
    const numbers = cpf.split("").map(Number);

    // Calculate first check digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += numbers[i] * (10 - i);
    }

    const firstDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (firstDigit !== numbers[9]) {
      return false;
    }

    // Calculate second check digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += numbers[i] * (11 - i);
    }

    const secondDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return secondDigit === numbers[10];
  }

  get formatted(): string {
    return this.value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  get checkDigits(): string {
    return this.value.substring(9, 11);
  }

  toString(): string {
    return this.value;
  }

  toJSON() {
    return {
      value: this.value,
      formatted: this.formatted,
      check_digits: this.checkDigits,
    };
  }
}

export class InvalidCPFError extends Error {
  constructor(message?: string) {
    super(message || "Invalid CPF");
    this.name = "InvalidCPFError";
  }
}
