import { ValueObject } from "../../../shared/domain/value-object";

export class SongTitle extends ValueObject {
  private static readonly MIN_LENGTH = 1;
  private static readonly MAX_LENGTH = 200;

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
      throw new Error("Song title is required and must be a string");
    }

    const trimmedValue = this.value.trim();

    if (trimmedValue.length < SongTitle.MIN_LENGTH) {
      throw new Error(
        `Song title must have at least ${SongTitle.MIN_LENGTH} character`,
      );
    }

    if (trimmedValue.length > SongTitle.MAX_LENGTH) {
      throw new Error(
        `Song title cannot exceed ${SongTitle.MAX_LENGTH} characters`,
      );
    }

    const dangerousChars = /[<>"'&]/;
    if (dangerousChars.test(trimmedValue)) {
      throw new Error("Song title contains invalid characters");
    }
  }

  static create(value: string): SongTitle {
    return new SongTitle(value);
  }

  get trimmedValue(): string {
    return this.value.trim();
  }

  get length(): number {
    return this.trimmedValue.length;
  }

  get capitalizedValue(): string {
    return this.trimmedValue
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  toString(): string {
    return this.trimmedValue;
  }

  equals(other: SongTitle): boolean {
    if (!other) return false;
    return this.trimmedValue === other.trimmedValue;
  }
}
