import { Chance } from "chance";

import { Address, SocialLinks, Uuid } from "../../shared/domain";
import { PriceRange } from "../../shared/domain/value-objects/price-range.vo";
import {
  EstablishmentProfile,
  EstablishmentProfileId,
} from "./establishment-profile.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class EstablishmentProfileFakeBuilder<TBuild = any> {
  private _profile_id: PropOrFactory<EstablishmentProfileId> | undefined =
    undefined;
  private _establishment_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _capacity: PropOrFactory<number | null> = (_index) => null;
  private _location: PropOrFactory<Address> = (_index) =>
    new Address({
      street: this.chance.street(),
      number: String(this.chance.integer({ min: 1, max: 9999 })),
      neighborhood: this.chance.city(),
      city: this.chance.city(),
      state: this.chance.state({ full: false }),
      zipCode: "01001000",
    });
  private _amenities: PropOrFactory<string[]> = (_index) => ["sound_system"];
  private _preferredGenres: PropOrFactory<string[]> = (_index) => ["Rock"];
  private _operatingHours: PropOrFactory<Record<string, unknown> | null> = (
    _index,
  ) => null;
  private _priceRange: PropOrFactory<PriceRange | null> = (_index) => null;
  private _socialLinks: PropOrFactory<SocialLinks | null> = (_index) => null;
  private _created_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;

  static aProfile() {
    return new EstablishmentProfileFakeBuilder<EstablishmentProfile>();
  }

  static theProfiles(countObjs: number) {
    return new EstablishmentProfileFakeBuilder<EstablishmentProfile[]>(
      countObjs,
    );
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withProfileId(valueOrFactory: PropOrFactory<EstablishmentProfileId>) {
    this._profile_id = valueOrFactory;
    return this;
  }

  withEstablishmentId(valueOrFactory: PropOrFactory<Uuid>) {
    this._establishment_id = valueOrFactory;
    return this;
  }

  withCapacity(valueOrFactory: PropOrFactory<number | null>) {
    this._capacity = valueOrFactory;
    return this;
  }

  withLocation(valueOrFactory: PropOrFactory<Address>) {
    this._location = valueOrFactory;
    return this;
  }

  withAmenities(valueOrFactory: PropOrFactory<string[]>) {
    this._amenities = valueOrFactory;
    return this;
  }

  withPreferredGenres(valueOrFactory: PropOrFactory<string[]>) {
    this._preferredGenres = valueOrFactory;
    return this;
  }

  withOperatingHours(
    valueOrFactory: PropOrFactory<Record<string, unknown> | null>,
  ) {
    this._operatingHours = valueOrFactory;
    return this;
  }

  withPriceRange(valueOrFactory: PropOrFactory<PriceRange | null>) {
    this._priceRange = valueOrFactory;
    return this;
  }

  withSocialLinks(valueOrFactory: PropOrFactory<SocialLinks | null>) {
    this._socialLinks = valueOrFactory;
    return this;
  }

  withInstagram(username: string) {
    this._socialLinks = (_index) =>
      SocialLinks.create([
        {
          platform: "instagram",
          username,
          url: `https://www.instagram.com/${username}`,
        },
      ]);
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  build(): TBuild {
    const profiles = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const profile = new EstablishmentProfile({
          profile_id: !this._profile_id
            ? undefined
            : this.callFactory(this._profile_id, index),
          establishment_id: this.callFactory(this._establishment_id, index),
          capacity: this.callFactory(this._capacity, index),
          location: this.callFactory(this._location, index),
          amenities: this.callFactory(this._amenities, index),
          preferredGenres: this.callFactory(this._preferredGenres, index),
          operatingHours: this.callFactory(this._operatingHours, index),
          priceRange: this.callFactory(this._priceRange, index),
          socialLinks: this.callFactory(this._socialLinks, index),
          ...(this._created_at && {
            created_at: this.callFactory(this._created_at, index),
          }),
        });
        profile.validate();
        return profile;
      });

    return this.countObjs === 1 ? (profiles[0] as any) : (profiles as any);
  }

  private callFactory<T>(factoryOrValue: PropOrFactory<T>, index: number): T {
    return typeof factoryOrValue === "function"
      ? (factoryOrValue as any)(index)
      : factoryOrValue;
  }
}
