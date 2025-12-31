import { ValueObject } from "../../../shared/domain/value-object";

export enum PixKeyType {
  CPF = "cpf",
  CNPJ = "cnpj",
  EMAIL = "email",
  PHONE = "phone",
  RANDOM = "random",
}

export class PixKey extends ValueObject {
  constructor(
    readonly key: string,
    readonly type: PixKeyType,
  ) {
    super();
    this.validate();
  }

  private validate(): void {
    if (!this.key) {
      throw new Error("Pix key cannot be empty");
    }

    switch (this.type) {
      case PixKeyType.CPF:
        this.validateCPF();
        break;
      case PixKeyType.CNPJ:
        this.validateCNPJ();
        break;
      case PixKeyType.EMAIL:
        this.validateEmail();
        break;
      case PixKeyType.PHONE:
        this.validatePhone();
        break;
      case PixKeyType.RANDOM:
        this.validateRandom();
        break;
    }
  }

  private validateCPF(): void {
    const cpfRegex = /^\d{11}$/;
    if (!cpfRegex.test(this.key.replace(/\D/g, ""))) {
      throw new Error("Invalid CPF format");
    }
  }

  private validateCNPJ(): void {
    const cnpjRegex = /^\d{14}$/;
    if (!cnpjRegex.test(this.key.replace(/\D/g, ""))) {
      throw new Error("Invalid CNPJ format");
    }
  }

  private validateEmail(): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.key)) {
      throw new Error("Invalid email format");
    }
  }

  private validatePhone(): void {
    // Formato E.164: +5511999999999
    const phoneRegex = /^\+\d{12,13}$/;
    if (!phoneRegex.test(this.key)) {
      throw new Error(
        "Invalid phone format. Use E.164 format (e.g., +5511999999999)",
      );
    }
  }

  private validateRandom(): void {
    // Chave aleatória UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(this.key)) {
      throw new Error("Invalid random key format (must be UUID)");
    }
  }

  static create(key: string, type: PixKeyType): PixKey {
    return new PixKey(key, type);
  }
}
