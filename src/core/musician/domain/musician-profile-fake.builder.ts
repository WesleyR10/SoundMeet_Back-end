import { Chance } from "chance";

import { Uuid } from "../../shared/domain";
import { Location } from "../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../shared/domain/value-objects/price-range.vo";
import {
  MusicianProfile,
  MusicianProfileId,
} from "./musician-profile.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class MusicianProfileFakeBuilder<TBuild = any> {
  private _profile_id: PropOrFactory<MusicianProfileId> | undefined = undefined;
  private _musician_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _priceRange: PropOrFactory<PriceRange | null> = (_index) => null;
  private _location: PropOrFactory<Location> = (_index) =>
    new Location({
      city: this.chance.city(),
      state: this.chance.state({ full: false }),
    });
  private _socialLinks: PropOrFactory<Record<string, unknown> | null> = (
    _index,
  ) => null;
  private _experience: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 0, max: 50 });
  private _instruments: PropOrFactory<string[]> = (_index) => ["Guitar"];
  private _genres: PropOrFactory<string[]> = (_index) => ["Rock"];
  private _created_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;

  static aProfile() {
    return new MusicianProfileFakeBuilder<MusicianProfile>();
  }

  static theProfiles(countObjs: number) {
    return new MusicianProfileFakeBuilder<MusicianProfile[]>(countObjs);
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withProfileId(valueOrFactory: PropOrFactory<MusicianProfileId>) {
    this._profile_id = valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<Uuid>) {
    this._musician_id = valueOrFactory;
    return this;
  }

  withPriceRange(valueOrFactory: PropOrFactory<PriceRange | null>) {
    this._priceRange = valueOrFactory;
    return this;
  }

  withLocation(valueOrFactory: PropOrFactory<Location>) {
    this._location = valueOrFactory;
    return this;
  }

  withSocialLinks(
    valueOrFactory: PropOrFactory<Record<string, unknown> | null>,
  ) {
    this._socialLinks = valueOrFactory;
    return this;
  }

  withExperience(valueOrFactory: PropOrFactory<number>) {
    this._experience = valueOrFactory;
    return this;
  }

  withInstruments(valueOrFactory: PropOrFactory<string[]>) {
    this._instruments = valueOrFactory;
    return this;
  }

  withGenres(valueOrFactory: PropOrFactory<string[]>) {
    this._genres = valueOrFactory;
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
        const profile = new MusicianProfile({
          profile_id: !this._profile_id
            ? undefined
            : this.callFactory(this._profile_id, index),
          musician_id: this.callFactory(this._musician_id, index),
          priceRange: this.callFactory(this._priceRange, index),
          location: this.callFactory(this._location, index),
          socialLinks: this.callFactory(this._socialLinks, index),
          experience: this.callFactory(this._experience, index),
          instruments: this.callFactory(this._instruments, index),
          genres: this.callFactory(this._genres, index),
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
