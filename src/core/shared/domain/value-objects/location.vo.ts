import { ValueObject } from "../value-object";

export type LocationProps = {
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // Endereço detalhado (opcional — jul/2026): o músico pode informar endereço
  // completo com CEP (autofill ViaCEP no app). Todos opcionais de propósito:
  // perfis antigos só têm city/state e continuam válidos. Endereço completo
  // OBRIGATÓRIO continua sendo exclusivo do establishment (Address VO).
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  zip_code?: string | null;
};

export class Location extends ValueObject {
  readonly city: string | null;
  readonly state: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly street: string | null;
  readonly number: string | null;
  readonly complement: string | null;
  readonly neighborhood: string | null;
  readonly zip_code: string | null;

  constructor(props: LocationProps) {
    super();
    this.city = props.city ?? null;
    this.state = props.state ?? null;
    this.latitude = props.latitude ?? null;
    this.longitude = props.longitude ?? null;
    this.street = props.street ?? null;
    this.number = props.number ?? null;
    this.complement = props.complement ?? null;
    this.neighborhood = props.neighborhood ?? null;
    this.zip_code = props.zip_code ? props.zip_code.replace(/\D/g, "") : null;
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

    for (const [field, value] of Object.entries({
      street: this.street,
      number: this.number,
      complement: this.complement,
      neighborhood: this.neighborhood,
    })) {
      if (value !== null && typeof value !== "string") {
        throw new InvalidLocationError(`${field} must be a string`);
      }
    }

    if (this.zip_code !== null && !/^\d{8}$/.test(this.zip_code)) {
      throw new InvalidLocationError(
        "Zip code (CEP) must have exactly 8 digits",
      );
    }
  }

  get hasCoordinates(): boolean {
    return this.latitude !== null && this.longitude !== null;
  }

  get coordinates(): { latitude: number; longitude: number } | null {
    if (!this.hasCoordinates) return null;
    return { latitude: this.latitude!, longitude: this.longitude! };
  }

  /** CEP formatado (00000-000) ou null. */
  get formattedZipCode(): string | null {
    if (!this.zip_code) return null;
    return `${this.zip_code.slice(0, 5)}-${this.zip_code.slice(5)}`;
  }

  toJSON() {
    return {
      city: this.city,
      state: this.state,
      latitude: this.latitude,
      longitude: this.longitude,
      street: this.street,
      number: this.number,
      complement: this.complement,
      neighborhood: this.neighborhood,
      zip_code: this.zip_code,
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
      street: (value as any).street,
      number: (value as any).number,
      complement: (value as any).complement,
      neighborhood: (value as any).neighborhood,
      zip_code: (value as any).zip_code,
    });
  }
}

export class InvalidLocationError extends Error {
  constructor(message?: string) {
    super(message || "Invalid location value");
    this.name = "InvalidLocationError";
  }
}
