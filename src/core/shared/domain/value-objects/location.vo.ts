import { ValueObject } from "../value-object";

export type LocationProps = {
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export class Location extends ValueObject {
  readonly city: string | null;
  readonly state: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;

  constructor(props: LocationProps) {
    super();
    this.city = props.city ?? null;
    this.state = props.state ?? null;
    this.latitude = props.latitude ?? null;
    this.longitude = props.longitude ?? null;
    this.validate();
  }

  private validate(): void {
    const hasLat = this.latitude !== null && this.latitude !== undefined;
    const hasLng = this.longitude !== null && this.longitude !== undefined;

    if (hasLat !== hasLng) {
      throw new InvalidLocationError(
        "Latitude and longitude must be provided together",
      );
    }

    if (hasLat) {
      if (!Number.isFinite(this.latitude as number)) {
        throw new InvalidLocationError("Latitude must be a finite number");
      }
      if ((this.latitude as number) < -90 || (this.latitude as number) > 90) {
        throw new InvalidLocationError("Latitude must be between -90 and 90");
      }
    }

    if (hasLng) {
      if (!Number.isFinite(this.longitude as number)) {
        throw new InvalidLocationError("Longitude must be a finite number");
      }
      if (
        (this.longitude as number) < -180 ||
        (this.longitude as number) > 180
      ) {
        throw new InvalidLocationError(
          "Longitude must be between -180 and 180",
        );
      }
    }

    if (this.city !== null && typeof this.city !== "string") {
      throw new InvalidLocationError("City must be a string");
    }

    if (this.state !== null && typeof this.state !== "string") {
      throw new InvalidLocationError("State must be a string");
    }
  }

  get hasCoordinates(): boolean {
    return this.latitude !== null && this.longitude !== null;
  }

  get coordinates(): { latitude: number; longitude: number } | null {
    if (!this.hasCoordinates) return null;
    return { latitude: this.latitude!, longitude: this.longitude! };
  }

  toJSON() {
    return {
      city: this.city,
      state: this.state,
      latitude: this.latitude,
      longitude: this.longitude,
    };
  }

  static fromJSON(value: any): Location {
    if (!value || typeof value !== "object") {
      return new Location({});
    }

    const coordinates = (value as any).coordinates;
    const lat =
      (value as any).latitude ??
      (coordinates ? (coordinates as any).lat : undefined);
    const lng =
      (value as any).longitude ??
      (coordinates ? (coordinates as any).lng : undefined);

    return new Location({
      city: (value as any).city,
      state: (value as any).state,
      latitude: lat,
      longitude: lng,
    });
  }
}

export class InvalidLocationError extends Error {
  constructor(message?: string) {
    super(message || "Invalid location value");
    this.name = "InvalidLocationError";
  }
}
