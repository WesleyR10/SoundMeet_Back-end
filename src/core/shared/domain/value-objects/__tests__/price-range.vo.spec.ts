import { Currency } from "../money.vo";
import { PriceRange } from "../price-range.vo";

describe("PriceRange Value Object", () => {
  it("should create a valid price range", () => {
    const priceRange = new PriceRange({
      model: "per_hour",
      min: 100,
      max: 200,
      currency: Currency.BRL,
      notes: "Negotiable",
    });

    expect(priceRange.model).toBe("per_hour");
    expect(priceRange.min).toBe(100);
    expect(priceRange.max).toBe(200);
    expect(priceRange.currency).toBe(Currency.BRL);
    expect(priceRange.notes).toBe("Negotiable");
  });

  it("should throw error if min price is negative", () => {
    expect(() => {
      new PriceRange({
        model: "per_hour",
        min: -10,
        max: 100,
        currency: Currency.BRL,
      });
    }).toThrow("Minimum price cannot be negative.");
  });

  it("should throw error if max price is less than min price", () => {
    expect(() => {
      new PriceRange({
        model: "per_hour",
        min: 100,
        max: 50,
        currency: Currency.BRL,
      });
    }).toThrow("Minimum price cannot be greater than maximum price.");
  });

  it("should create with default currency BRL if not provided", () => {
    const priceRange = new PriceRange({
      model: "per_event",
      min: 500,
      max: 1000,
    });

    expect(priceRange.currency).toBe(Currency.BRL);
  });

  it("should throw error if min is not finite", () => {
    expect(() => {
      new PriceRange({
        model: "per_event",
        min: Number.NaN,
        max: 100,
        currency: Currency.BRL,
      });
    }).toThrow("Minimum price must be a finite number.");
  });

  it("should throw error if max is not finite", () => {
    expect(() => {
      new PriceRange({
        model: "per_event",
        min: 10,
        max: Number.POSITIVE_INFINITY,
        currency: Currency.BRL,
      });
    }).toThrow("Maximum price must be a finite number.");
  });

  it("should throw error if has more than 2 decimal places", () => {
    expect(() => {
      new PriceRange({
        model: "per_hour",
        min: 10.123,
        max: 20,
        currency: Currency.BRL,
      });
    }).toThrow("Prices cannot have more than 2 decimal places.");
  });
});
