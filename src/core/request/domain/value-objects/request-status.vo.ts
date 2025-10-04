import { ValueObject } from "../../../shared/domain/value-object";

export enum RequestStatusEnum {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

export class RequestStatus extends ValueObject {
  constructor(readonly value: RequestStatusEnum) {
    super();
    this.validate();
  }

  private validate(): void {
    if (this.value === null || this.value === undefined) {
      throw new Error("Request status is required");
    }

    if (!Object.values(RequestStatusEnum).includes(this.value)) {
      throw new Error(`Invalid request status: ${this.value}`);
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

  isPending(): boolean {
    return this.value === RequestStatusEnum.PENDING;
  }

  isAccepted(): boolean {
    return this.value === RequestStatusEnum.ACCEPTED;
  }

  isRejected(): boolean {
    return this.value === RequestStatusEnum.REJECTED;
  }

  toString(): string {
    return this.value;
  }

  equals(other: RequestStatus): boolean {
    if (!other) return false;
    return this.value === other.value;
  }
}
