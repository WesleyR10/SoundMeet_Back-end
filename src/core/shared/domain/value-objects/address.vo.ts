import { ValueObject } from "../value-object";

export class Address extends ValueObject {
  readonly street: string;
  readonly number: string;
  readonly complement?: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly country: string;
  readonly latitude?: number;
  readonly longitude?: number;

  constructor(props: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  }) {
    super();
    this.street = props.street;
    this.number = props.number;
    this.complement = props.complement;
    this.neighborhood = props.neighborhood;
    this.city = props.city;
    this.state = props.state;
    this.zipCode = props.zipCode;
    this.country = props.country || "Brasil";
    this.latitude = props.latitude;
    this.longitude = props.longitude;
    this.validate();
  }

  private validate(): void {
    if (!this.street || this.street.trim().length === 0) {
      throw new InvalidAddressError("Street is required");
    }

    if (!this.number || this.number.trim().length === 0) {
      throw new InvalidAddressError("Number is required");
    }

    if (!this.neighborhood || this.neighborhood.trim().length === 0) {
      throw new InvalidAddressError("Neighborhood is required");
    }

    if (!this.city || this.city.trim().length === 0) {
      throw new InvalidAddressError("City is required");
    }

    if (!this.state || this.state.trim().length === 0) {
      throw new InvalidAddressError("State is required");
    }

    if (!this.zipCode || this.zipCode.trim().length === 0) {
      throw new InvalidAddressError("Zip code is required");
    }

    // Validar CEP brasileiro
    if (this.country === "Brasil") {
      const cleanZipCode = this.zipCode.replace(/\D/g, "");
      if (cleanZipCode.length !== 8) {
        throw new InvalidAddressError("Brazilian zip code must have 8 digits");
      }
    }

    // Validar coordenadas se fornecidas
    if (this.latitude !== undefined) {
      if (this.latitude < -90 || this.latitude > 90) {
        throw new InvalidAddressError("Latitude must be between -90 and 90");
      }
    }

    if (this.longitude !== undefined) {
      if (this.longitude < -180 || this.longitude > 180) {
        throw new InvalidAddressError("Longitude must be between -180 and 180");
      }
    }
  }

  get formattedZipCode(): string {
    if (this.country === "Brasil") {
      const clean = this.zipCode.replace(/\D/g, "");
      return `${clean.substring(0, 5)}-${clean.substring(5)}`;
    }
    return this.zipCode;
  }

  get fullAddress(): string {
    const parts = [
      `${this.street}, ${this.number}`,
      this.complement,
      this.neighborhood,
      this.city,
      this.state,
      this.formattedZipCode,
      this.country !== "Brasil" ? this.country : undefined,
    ].filter(Boolean);

    return parts.join(", ");
  }

  get shortAddress(): string {
    return `${this.street}, ${this.number} - ${this.neighborhood}, ${this.city}/${this.state}`;
  }

  get hasCoordinates(): boolean {
    return this.latitude !== undefined && this.longitude !== undefined;
  }

  get coordinates(): { latitude: number; longitude: number } | null {
    if (this.hasCoordinates) {
      return {
        latitude: this.latitude!,
        longitude: this.longitude!,
      };
    }
    return null;
  }

  distanceTo(other: Address): number | null {
    if (!this.hasCoordinates || !other.hasCoordinates) {
      return null;
    }

    const R = 6371; // Raio da Terra em km
    const dLat = this.toRadians(other.latitude! - this.latitude!);
    const dLon = this.toRadians(other.longitude! - this.longitude!);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(this.latitude!)) *
        Math.cos(this.toRadians(other.latitude!)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distância em km
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  toJSON() {
    return {
      street: this.street,
      number: this.number,
      complement: this.complement,
      neighborhood: this.neighborhood,
      city: this.city,
      state: this.state,
      zipCode: this.zipCode,
      formattedZipCode: this.formattedZipCode,
      country: this.country,
      latitude: this.latitude,
      longitude: this.longitude,
      fullAddress: this.fullAddress,
      shortAddress: this.shortAddress,
      hasCoordinates: this.hasCoordinates,
      coordinates: this.coordinates,
    };
  }
}

export class InvalidAddressError extends Error {
  constructor(message?: string) {
    super(message || "Invalid address");
    this.name = "InvalidAddressError";
  }
}
