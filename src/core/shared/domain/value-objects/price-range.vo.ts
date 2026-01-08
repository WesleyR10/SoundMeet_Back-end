import { ValueObject } from "../value-object";
import { Currency } from "./money.vo";

export type PriceModel = "per_event" | "per_hour";

export type PriceRangeProps = {
  model: PriceModel;
  min: number;
  max: number;
  currency?: Currency;
  notes?: string | null;
};

export class PriceRange extends ValueObject {
  readonly model: PriceModel;
  readonly min: number;
  readonly max: number;
  readonly currency: Currency;
  readonly notes: string | null;

  constructor(props: PriceRangeProps) {
    super();
    this.model = props.model;
    this.min = props.min;
    this.max = props.max;
    this.currency = props.currency ?? Currency.BRL;
    this.notes = props.notes ?? null;
    this.validate();
  }

  private validate(): void {
    if (!["per_event", "per_hour"].includes(this.model)) {
      throw new InvalidPriceRangeError(
        `Invalid price model: ${this.model}. Must be 'per_event' or 'per_hour'.`,
      );
    }

    if (!Number.isFinite(this.min)) {
      throw new InvalidPriceRangeError(
        "Minimum price must be a finite number.",
      );
    }

    if (!Number.isFinite(this.max)) {
      throw new InvalidPriceRangeError(
        "Maximum price must be a finite number.",
      );
    }

    if (this.min < 0) {
      throw new InvalidPriceRangeError("Minimum price cannot be negative.");
    }

    if (this.max < 0) {
      throw new InvalidPriceRangeError("Maximum price cannot be negative.");
    }

    if (this.min > this.max) {
      throw new InvalidPriceRangeError(
        "Minimum price cannot be greater than maximum price.",
      );
    }

    const minDecimals = (this.min.toString().split(".")[1] || "").length;
    const maxDecimals = (this.max.toString().split(".")[1] || "").length;
    if (minDecimals > 2 || maxDecimals > 2) {
      throw new InvalidPriceRangeError(
        "Prices cannot have more than 2 decimal places.",
      );
    }

    if (this.notes && this.notes.length > 500) {
      throw new InvalidPriceRangeError(
        "Notes cannot be longer than 500 characters.",
      );
    }
  }

  format(): string {
    return `${this.currency} ${this.min.toFixed(2)} - ${this.max.toFixed(2)} / ${this.model === "per_hour" ? "hour" : "event"}`;
  }

  toJSON() {
    return {
      model: this.model,
      min: this.min,
      max: this.max,
      currency: this.currency,
      notes: this.notes,
    };
  }

  static fromJSON(json: any): PriceRange {
    if (!json) {
      throw new InvalidPriceRangeError("Invalid JSON for PriceRange");
    }
    return new PriceRange({
      model: json.model,
      min: json.min,
      max: json.max,
      currency: json.currency,
      notes: json.notes,
    });
  }
}

export class InvalidPriceRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPriceRangeError";
  }
}
