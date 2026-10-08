import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { ValueObject } from "../../../shared/domain/value-object";

export enum PixKeyType {
  CPF = "cpf",
  CNPJ = "cnpj",
  EMAIL = "email",
  PHONE = "phone",
  RANDOM = "random",
}

export class PixKey extends ValueObject {
  readonly key: string;
  readonly type: PixKeyType;

  /**
   * O `type` entra como `string` de propósito: ele nasce de input do usuário
   * (DTO) e de coluna do banco, nunca de um `PixKeyType` já garantido. O
   * construtor é a fronteira que valida — quem chamava com `type as any`
   * furava exatamente esta checagem.
   */
  constructor(key: string, type: string) {
    super();
    this.key = key;
    this.type = PixKey.normalizeType(type);
    this.validate();
  }

  /** `true` se `type` é um `PixKeyType` conhecido — guard para a carga (mapper). */
  static isValidType(type: string | null | undefined): type is PixKeyType {
    return (
      typeof type === "string" &&
      (Object.values(PixKeyType) as string[]).includes(type)
    );
  }

  private static normalizeType(type: string): PixKeyType {
    if (!PixKey.isValidType(type)) {
      throw new InvalidArgumentError(`Invalid Pix key type: ${type}`);
    }
    return type;
  }

  private validate(): void {
    if (!this.key) {
      throw new InvalidArgumentError("Pix key cannot be empty");
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
      default:
        // Inalcançável: `normalizeType` já barrou tipo desconhecido. Fica como
        // defesa-em-profundidade — um `type` novo no enum sem `case` aqui não
        // deve passar sem validação de formato, que era a origem do bypass.
        throw new InvalidArgumentError(`Invalid Pix key type: ${this.type}`);
    }
  }

  private validateCPF(): void {
    const cpfRegex = /^\d{11}$/;
    if (!cpfRegex.test(this.key.replace(/\D/g, ""))) {
      throw new InvalidArgumentError("Invalid CPF format");
    }
  }

  private validateCNPJ(): void {
    const cnpjRegex = /^\d{14}$/;
    if (!cnpjRegex.test(this.key.replace(/\D/g, ""))) {
      throw new InvalidArgumentError("Invalid CNPJ format");
    }
  }

  private validateEmail(): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.key)) {
      throw new InvalidArgumentError("Invalid email format");
    }
  }

  private validatePhone(): void {
    // Formato E.164: +5511999999999
    const phoneRegex = /^\+\d{12,13}$/;
    if (!phoneRegex.test(this.key)) {
      throw new InvalidArgumentError(
        "Invalid phone format. Use E.164 format (e.g., +5511999999999)",
      );
    }
  }

  private validateRandom(): void {
    // Chave aleatória UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(this.key)) {
      throw new InvalidArgumentError(
        "Invalid random key format (must be UUID)",
      );
    }
  }

  static create(key: string, type: string): PixKey {
    return new PixKey(key, type);
  }
}
