import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { ValueObject } from "../../../shared/domain/value-object";

export enum RequestStatusEnum {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  PLAYED = "played",
}

export class RequestStatus extends ValueObject {
  constructor(readonly value: RequestStatusEnum) {
    super();
    this.validate();
  }

  private validate(): void {
    if (this.value === null || this.value === undefined) {
      throw new InvalidArgumentError("Request status is required");
    }

    if (!Object.values(RequestStatusEnum).includes(this.value)) {
      throw new InvalidArgumentError(`Invalid request status: ${this.value}`);
    }
  }

  static create(value: string): RequestStatus {
    return new RequestStatus(value as RequestStatusEnum);
  }

  static pending(): RequestStatus {
    return new RequestStatus(RequestStatusEnum.PENDING);
  }

  static accepted(): RequestStatus {
    return new RequestStatus(RequestStatusEnum.ACCEPTED);
  }

  static rejected(): RequestStatus {
    return new RequestStatus(RequestStatusEnum.REJECTED);
  }

  static played(): RequestStatus {
    return new RequestStatus(RequestStatusEnum.PLAYED);
  }

  isPending(): boolean {
    return this.value === RequestStatusEnum.PENDING;
  }

  isAccepted(): boolean {
    return this.value === RequestStatusEnum.ACCEPTED;
  }

  isRejected(): boolean {
    return this.value === RequestStatusEnum.REJECTED;
  }

  isPlayed(): boolean {
    return this.value === RequestStatusEnum.PLAYED;
  }

  toString(): string {
    return this.value;
  }

  equals(other: RequestStatus): boolean {
    if (!other) return false;
    return this.value === other.value;
  }
}
