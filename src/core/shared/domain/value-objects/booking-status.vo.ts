import { InvalidArgumentError } from "../errors/invalid-argument.error";
import { ValueObject } from "../value-object";

export enum BookingStatusEnum {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
  EXPIRED = "expired",
}

export class BookingStatus extends ValueObject {
  constructor(readonly value: BookingStatusEnum) {
    super();
    this.validate();
  }

  private validate(): void {
    if (this.value === null || this.value === undefined) {
      throw new InvalidArgumentError("Booking status is required");
    }

    if (!Object.values(BookingStatusEnum).includes(this.value)) {
      throw new InvalidArgumentError(`Invalid booking status: ${this.value}`);
    }
  }

  static create(value: string): BookingStatus {
    return new BookingStatus(value as BookingStatusEnum);
  }

  static pending(): BookingStatus {
    return new BookingStatus(BookingStatusEnum.PENDING);
  }

  static confirmed(): BookingStatus {
    return new BookingStatus(BookingStatusEnum.CONFIRMED);
  }

  static cancelled(): BookingStatus {
    return new BookingStatus(BookingStatusEnum.CANCELLED);
  }

  static completed(): BookingStatus {
    return new BookingStatus(BookingStatusEnum.COMPLETED);
  }

  static expired(): BookingStatus {
    return new BookingStatus(BookingStatusEnum.EXPIRED);
  }

  isPending(): boolean {
    return this.value === BookingStatusEnum.PENDING;
  }

  isConfirmed(): boolean {
    return this.value === BookingStatusEnum.CONFIRMED;
  }

  isCancelled(): boolean {
    return this.value === BookingStatusEnum.CANCELLED;
  }

  isCompleted(): boolean {
    return this.value === BookingStatusEnum.COMPLETED;
  }

  isExpired(): boolean {
    return this.value === BookingStatusEnum.EXPIRED;
  }

  toString(): string {
    return this.value;
  }
}
