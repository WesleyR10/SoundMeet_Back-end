import { OperatingHours } from "@core/shared/domain/value-objects/operating-hours.vo";

import { Address, AggregateRoot, SocialLinks, Uuid } from "../../shared/domain";
import { PriceRange } from "../../shared/domain/value-objects/price-range.vo";
import { EstablishmentProfileValidatorFactory } from "./establishment-profile.validator";
import { EstablishmentProfileFakeBuilder } from "./establishment-profile-fake.builder";

export const MENU_PDF_MAX_COUNT = 2;

export type MenuPdfEntry = {
  id: string;
  url: string;
  key: string;
  uploaded_at: Date;
};

export type EstablishmentProfileOperatingHoursInput = Record<string, unknown>;

export type EstablishmentProfileConstructorProps = {
  profile_id?: EstablishmentProfileId;
  establishment_id: Uuid;
  capacity?: number | null;
  location: Address;
  amenities?: string[];
  preferredGenres?: string[];
  operatingHours?:
    | OperatingHours
    | EstablishmentProfileOperatingHoursInput
    | null;
  priceRange?: PriceRange | null;
  socialLinks?: SocialLinks | null;
  menu_pdfs?: MenuPdfEntry[];
  created_at?: Date;
  updated_at?: Date;
};

export type EstablishmentProfileCreateCommand = {
  profile_id?: EstablishmentProfileId;
  establishment_id: Uuid;
  capacity?: number | null;
  location: Address;
  amenities?: string[];
  preferredGenres?: string[];
  operatingHours?:
    | OperatingHours
    | EstablishmentProfileOperatingHoursInput
    | null;
  priceRange?: PriceRange | null;
  socialLinks?: SocialLinks | null;
  menu_pdfs?: MenuPdfEntry[];
};

export class EstablishmentProfileId extends Uuid {}

export class EstablishmentProfile extends AggregateRoot {
  profile_id: EstablishmentProfileId;
  establishment_id: Uuid;
  capacity: number | null;
  location: Address;
  amenities: string[];
  preferredGenres: string[];
  operatingHours: OperatingHours | null;
  priceRange: PriceRange | null;
  socialLinks: SocialLinks | null;
  menu_pdfs: MenuPdfEntry[];
  created_at: Date;
  updated_at: Date;

  constructor(props: EstablishmentProfileConstructorProps) {
    super();
    this.profile_id = props.profile_id ?? new EstablishmentProfileId();
    this.establishment_id = props.establishment_id;
    this.capacity = props.capacity ?? null;
    this.location = props.location;
    this.amenities = props.amenities ?? [];
    this.preferredGenres = props.preferredGenres ?? [];
    this.operatingHours = null;
    if (props.operatingHours !== undefined) {
      this.changeOperatingHours(props.operatingHours);
    }
    this.priceRange = props.priceRange ?? null;
    this.socialLinks = props.socialLinks ?? null;
    this.menu_pdfs = props.menu_pdfs ?? [];
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): Uuid {
    return this.profile_id;
  }

  static create(
    command: EstablishmentProfileCreateCommand,
  ): EstablishmentProfile {
    const profile = new EstablishmentProfile(command);
    profile.validate();
    return profile;
  }

  validate(fields?: string[]) {
    const validator = EstablishmentProfileValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  changeCapacity(capacity: number | null) {
    if (capacity !== null && capacity < 0) {
      this.notification.addError("Capacity cannot be negative", "capacity");
      return;
    }
    this.capacity = capacity;
    this.updated_at = new Date();
  }

  changeLocation(location: Address) {
    this.location = location;
    this.updated_at = new Date();
  }

  updateAmenities(amenities: string[]) {
    this.amenities = amenities;
    this.updated_at = new Date();
  }

  updatePreferredGenres(preferredGenres: string[]) {
    this.preferredGenres = preferredGenres;
    this.updated_at = new Date();
  }

  changeOperatingHours(
    operatingHours:
      | OperatingHours
      | EstablishmentProfileOperatingHoursInput
      | null,
  ) {
    if (operatingHours === null) {
      this.operatingHours = null;
      this.updated_at = new Date();
      return;
    }

    if (operatingHours instanceof OperatingHours) {
      this.operatingHours = operatingHours;
      this.updated_at = new Date();
      return;
    }

    try {
      this.operatingHours = OperatingHours.fromJSON(operatingHours);
      this.updated_at = new Date();
    } catch (error: any) {
      this.notification.addError(
        error?.message ?? "Invalid operating hours",
        "operatingHours",
      );
    }
  }

  changePriceRange(priceRange: PriceRange | null) {
    this.priceRange = priceRange;
    this.updated_at = new Date();
  }

  changeSocialLinks(socialLinks: SocialLinks | null) {
    this.socialLinks = socialLinks;
    this.updated_at = new Date();
  }

  addMenuPdf(entry: { url: string; key: string }): MenuPdfEntry {
    const newEntry: MenuPdfEntry = {
      id: new Uuid().id,
      url: entry.url,
      key: entry.key,
      uploaded_at: new Date(),
    };
    this.menu_pdfs = [...this.menu_pdfs, newEntry];
    this.updated_at = new Date();
    return newEntry;
  }

  removeMenuPdf(pdf_id: string): MenuPdfEntry | undefined {
    const entry = this.menu_pdfs.find((e) => e.id === pdf_id);
    if (entry) {
      this.menu_pdfs = this.menu_pdfs.filter((e) => e.id !== pdf_id);
      this.updated_at = new Date();
    }
    return entry;
  }

  toJSON() {
    return {
      profile_id: this.profile_id.id,
      establishment_id: this.establishment_id.id,
      capacity: this.capacity,
      location: this.location.toJSON(),
      amenities: this.amenities,
      preferredGenres: this.preferredGenres,
      operatingHours: this.operatingHours?.toJSON() ?? null,
      priceRange: this.priceRange?.toJSON() || null,
      socialLinks: this.socialLinks?.toJSON() ?? null,
      menu_pdfs: this.menu_pdfs.map((e) => ({
        id: e.id,
        url: e.url,
        key: e.key,
        uploaded_at: e.uploaded_at,
      })),
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  static fake() {
    return EstablishmentProfileFakeBuilder;
  }
}
