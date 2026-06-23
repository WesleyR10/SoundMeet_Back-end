import { Either } from "../either";
import { ValueObject } from "../value-object";

export class Email extends ValueObject {
  readonly value: string;

  constructor(value: string) {
    super();
    this.value = value;
    this.validate();
  }

  static create(value: string): Either<Email, InvalidEmailError> {
    return Either.safe<Email, InvalidEmailError>(() => new Email(value));
  }

  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new InvalidEmailError("Email cannot be empty");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.value)) {
      throw new InvalidEmailError("Invalid email format");
    }

    if (this.value.length > 254) {
      throw new InvalidEmailError("Email is too long");
    }
  }

  get domain(): string {
    return this.value.split("@")[1];
  }

  get localPart(): string {
    return this.value.split("@")[0];
  }

  toString(): string {
    return this.value;
  }

  toJSON() {
    return {
      value: this.value,
      domain: this.domain,
      localPart: this.localPart,
    };
  }
}

export class InvalidEmailError extends Error {
  constructor(message?: string) {
    super(message || "Invalid email");
    this.name = "InvalidEmailError";
  }
}
