import { InvalidArgumentError } from "../errors/invalid-argument.error";
import { ValueObject } from "../value-object";

export class QRCode extends ValueObject {
  readonly code: string;
  readonly url: string;
  readonly expiresAt?: Date;

  constructor({
    code,
    url,
    expiresAt,
  }: {
    code: string;
    url: string;
    expiresAt?: Date;
  }) {
    super();
    this.code = code;
    this.url = url;
    this.expiresAt = expiresAt;
    this.validate();
  }

  private validate(): void {
    if (!this.code || this.code.trim().length === 0) {
      throw new InvalidArgumentError("QR Code cannot be empty");
    }

    if (!this.url || this.url.trim().length === 0) {
      throw new InvalidArgumentError("QR Code URL cannot be empty");
    }

    // Validar formato de URL
    try {
      new URL(this.url);
    } catch {
      throw new InvalidArgumentError("QR Code URL must be a valid URL");
    }

    if (this.expiresAt && this.expiresAt <= new Date()) {
      throw new InvalidArgumentError(
        "QR Code expiration date must be in the future",
      );
    }
  }

  get isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return this.expiresAt <= new Date();
  }

  get isValid(): boolean {
    return !this.isExpired;
  }

  get formatted(): string {
    // Retorna o código QR como base64 para uso em aplicações
    return btoa(this.code);
  }

  toJSON() {
    return {
      code: this.code,
      url: this.url,
      formatted: this.formatted,
      expiresAt: this.expiresAt,
      isExpired: this.isExpired,
      isValid: this.isValid,
    };
  }
}
