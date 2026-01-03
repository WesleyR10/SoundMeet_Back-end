import { InvalidArgumentError } from "../errors/invalid-argument.error";
import { ValueObject } from "../value-object";

export enum InquiryStatusEnum {
  OPEN = "open",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  CONVERTED = "converted",
  EXPIRED = "expired",
}

export class InquiryStatus extends ValueObject {
  constructor(readonly value: InquiryStatusEnum) {
    super();
    this.validate();
  }

  private validate(): void {
    if (this.value === null || this.value === undefined) {
      throw new InvalidArgumentError("Inquiry status is required");
    }

    if (!Object.values(InquiryStatusEnum).includes(this.value)) {
      throw new InvalidArgumentError(`Invalid inquiry status: ${this.value}`);
    }
  }

  static create(value: string): InquiryStatus {
    return new InquiryStatus(value as InquiryStatusEnum);
  }

  static open(): InquiryStatus {
    return new InquiryStatus(InquiryStatusEnum.OPEN);
  }

  static accepted(): InquiryStatus {
    return new InquiryStatus(InquiryStatusEnum.ACCEPTED);
  }

  static rejected(): InquiryStatus {
    return new InquiryStatus(InquiryStatusEnum.REJECTED);
  }

  static converted(): InquiryStatus {
    return new InquiryStatus(InquiryStatusEnum.CONVERTED);
  }

  static expired(): InquiryStatus {
    return new InquiryStatus(InquiryStatusEnum.EXPIRED);
  }

  isOpen(): boolean {
    return this.value === InquiryStatusEnum.OPEN;
  }

  isAccepted(): boolean {
    return this.value === InquiryStatusEnum.ACCEPTED;
  }

  isRejected(): boolean {
    return this.value === InquiryStatusEnum.REJECTED;
  }

  isConverted(): boolean {
    return this.value === InquiryStatusEnum.CONVERTED;
  }

  isExpired(): boolean {
    return this.value === InquiryStatusEnum.EXPIRED;
  }

  toString(): string {
    return this.value;
  }
}
