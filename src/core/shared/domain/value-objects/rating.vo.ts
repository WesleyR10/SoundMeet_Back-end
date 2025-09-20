import { ValueObject } from "../value-object";

export class Rating extends ValueObject {
  readonly value: number;
  readonly maxValue: number;

  constructor(value: number, maxValue: number = 5) {
    super();
    this.value = value;
    this.maxValue = maxValue;
    this.validate();
  }

  private validate(): void {
    if (this.value < 0) {
      throw new InvalidRatingError("Rating cannot be negative");
    }

    if (this.value > this.maxValue) {
      throw new InvalidRatingError(
        `Rating cannot be greater than ${this.maxValue}`,
      );
    }

    if (!Number.isFinite(this.value)) {
      throw new InvalidRatingError("Rating must be a finite number");
    }

    // Validar precisão (máximo 1 casa decimal)
    const decimalPlaces = (this.value.toString().split(".")[1] || "").length;
    if (decimalPlaces > 1) {
      throw new InvalidRatingError(
        "Rating cannot have more than 1 decimal place",
      );
    }
  }

  get percentage(): number {
    return (this.value / this.maxValue) * 100;
  }

  get stars(): string {
    const fullStars = Math.floor(this.value);
    const hasHalfStar = this.value % 1 >= 0.5;
    const emptyStars = this.maxValue - fullStars - (hasHalfStar ? 1 : 0);

    return (
      "★".repeat(fullStars) + (hasHalfStar ? "☆" : "") + "☆".repeat(emptyStars)
    );
  }

  get isExcellent(): boolean {
    return this.value >= this.maxValue * 0.9; // 90% ou mais
  }

  get isGood(): boolean {
    return this.value >= this.maxValue * 0.7; // 70% ou mais
  }

  get isAverage(): boolean {
    return this.value >= this.maxValue * 0.5; // 50% ou mais
  }

  get isPoor(): boolean {
    return this.value < this.maxValue * 0.5; // Menos de 50%
  }

  get qualityLevel(): string {
    if (this.isExcellent) return "Excelente";
    if (this.isGood) return "Bom";
    if (this.isAverage) return "Regular";
    return "Ruim";
  }

  static fromPercentage(percentage: number, maxValue: number = 5): Rating {
    const value = (percentage / 100) * maxValue;
    return new Rating(Math.round(value * 10) / 10, maxValue); // Arredondar para 1 casa decimal
  }

  static average(ratings: Rating[]): Rating {
    if (ratings.length === 0) {
      throw new InvalidRatingError(
        "Cannot calculate average of empty ratings array",
      );
    }

    const maxValue = ratings[0].maxValue;
    if (!ratings.every((r) => r.maxValue === maxValue)) {
      throw new InvalidRatingError("All ratings must have the same max value");
    }

    const sum = ratings.reduce((acc, rating) => acc + rating.value, 0);
    const average = sum / ratings.length;
    return new Rating(Math.round(average * 10) / 10, maxValue);
  }

  toJSON() {
    return {
      value: this.value,
      maxValue: this.maxValue,
      percentage: this.percentage,
      stars: this.stars,
      qualityLevel: this.qualityLevel,
      isExcellent: this.isExcellent,
      isGood: this.isGood,
      isAverage: this.isAverage,
      isPoor: this.isPoor,
    };
  }
}

export class InvalidRatingError extends Error {
  constructor(message?: string) {
    super(message || "Invalid rating value");
    this.name = "InvalidRatingError";
  }
}
