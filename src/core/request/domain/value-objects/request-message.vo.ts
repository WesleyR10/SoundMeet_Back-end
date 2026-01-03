import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { ValueObject } from "../../../shared/domain/value-object";

export class RequestMessage extends ValueObject {
  private static readonly MIN_LENGTH = 1;
  private static readonly MAX_LENGTH = 500;

  constructor(readonly value: string) {
    super();
    this.validate();
  }

  private validate(): void {
    if (
      this.value === null ||
      this.value === undefined ||
      typeof this.value !== "string"
    ) {
      throw new InvalidArgumentError(
        "Request message is required and must be a string",
      );
    }

    const trimmedValue = this.value.trim();

    if (trimmedValue.length < RequestMessage.MIN_LENGTH) {
      throw new InvalidArgumentError(
        `Request message must have at least ${RequestMessage.MIN_LENGTH} character`,
      );
    }

    if (trimmedValue.length > RequestMessage.MAX_LENGTH) {
      throw new InvalidArgumentError(
        `Request message cannot exceed ${RequestMessage.MAX_LENGTH} characters`,
      );
    }
  }

  static create(value: string): RequestMessage {
    return new RequestMessage(value);
  }

  get trimmedValue(): string {
    return this.value.trim();
  }

  get length(): number {
    return this.trimmedValue.length;
  }

  toString(): string {
    return this.trimmedValue;
  }

  equals(other: RequestMessage): boolean {
    if (!other) return false;
    return this.trimmedValue === other.trimmedValue;
  }
}
