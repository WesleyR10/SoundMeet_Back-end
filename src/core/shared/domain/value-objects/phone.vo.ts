import { ValueObject } from "../value-object";

export class Phone extends ValueObject {
  readonly value: string;
  readonly countryCode: string;
  readonly number: string;

  constructor(value: string) {
    super();
    this.value = this.normalize(value);
    const parsed = this.parsePhone(this.value);
    this.countryCode = parsed.countryCode;
    this.number = parsed.number;
    this.validate();
  }

  private normalize(phone: string): string {
    // Remove todos os caracteres não numéricos exceto o +
    return phone.replace(/[^\d+]/g, "");
  }

  private parsePhone(phone: string): { countryCode: string; number: string } {
    // Se começar com +, extrair código do país
    if (phone.startsWith("+")) {
      // Assumir que os primeiros 2-3 dígitos são o código do país
      const match = phone.match(/^\+(\d{1,3})(\d+)$/);
      if (match) {
        return {
          countryCode: `+${match[1]}`,
          number: match[2],
        };
      }
    }

    // Se começar com 55 (Brasil) e tiver mais de 11 dígitos
    if (phone.startsWith("55") && phone.length > 11) {
      return {
        countryCode: "+55",
        number: phone.substring(2),
      };
    }

    // Assumir Brasil como padrão
    return {
      countryCode: "+55",
      number: phone,
    };
  }

  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new InvalidPhoneError("Phone cannot be empty");
    }

    // Validar formato básico
    if (!this.value.match(/^\+?\d{8,15}$/)) {
      throw new InvalidPhoneError("Invalid phone format");
    }

    // Validar número brasileiro se for +55
    if (this.countryCode === "+55") {
      if (this.number.length < 10 || this.number.length > 11) {
        throw new InvalidPhoneError(
          "Brazilian phone must have 10 or 11 digits",
        );
      }
    }
  }

  get formatted(): string {
    if (this.countryCode === "+55" && this.number.length === 11) {
      // Formato brasileiro com celular: +55 (11) 99999-9999
      const ddd = this.number.substring(0, 2);
      const firstPart = this.number.substring(2, 7);
      const secondPart = this.number.substring(7);
      return `${this.countryCode} (${ddd}) ${firstPart}-${secondPart}`;
    }

    if (this.countryCode === "+55" && this.number.length === 10) {
      // Formato brasileiro fixo: +55 (11) 9999-9999
      const ddd = this.number.substring(0, 2);
      const firstPart = this.number.substring(2, 6);
      const secondPart = this.number.substring(6);
      return `${this.countryCode} (${ddd}) ${firstPart}-${secondPart}`;
    }

    return `${this.countryCode} ${this.number}`;
  }

  get isMobile(): boolean {
    if (this.countryCode === "+55") {
      // No Brasil, celulares têm 11 dígitos e começam com 9
      return this.number.length === 11 && this.number.charAt(2) === "9";
    }
    return false;
  }

  toString(): string {
    return this.value;
  }

  toJSON() {
    return {
      value: this.value,
      countryCode: this.countryCode,
      number: this.number,
      formatted: this.formatted,
      isMobile: this.isMobile,
    };
  }
}

export class InvalidPhoneError extends Error {
  constructor(message?: string) {
    super(message || "Invalid phone number");
    this.name = "InvalidPhoneError";
  }
}
