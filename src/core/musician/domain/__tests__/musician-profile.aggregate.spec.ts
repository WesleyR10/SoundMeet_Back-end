import { Uuid } from "../../../shared/domain";
import { Location } from "../../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../../shared/domain/value-objects/price-range.vo";
import {
  MusicianProfile,
  MusicianProfileId,
} from "../musician-profile.aggregate";

describe("MusicianProfile Without Validator Unit Tests", () => {
  beforeEach(() => {
    MusicianProfile.prototype.validate = jest
      .fn()
      .mockImplementation(MusicianProfile.prototype.validate);
  });

  test("constructor of musician profile", () => {
    const musician_id = new Uuid();
    let profile = new MusicianProfile({
      musician_id,
    });

    expect(profile.profile_id).toBeInstanceOf(MusicianProfileId);
    expect(profile.musician_id).toBe(musician_id);
    expect(profile.priceRange).toBeNull();
    expect(profile.location).toBeInstanceOf(Location);
    expect(profile.socialLinks).toBeNull();
    expect(profile.experience).toBe(0);
    expect(profile.instruments).toEqual([]);
    expect(profile.genres).toEqual([]);
    expect(profile.rating.value).toBe(0);
    expect(profile.total_ratings).toBe(0);
    expect(profile.created_at).toBeInstanceOf(Date);
    expect(profile.updated_at).toBeInstanceOf(Date);

    const profile_id = new MusicianProfileId();
    const location = new Location({ city: "São Paulo", state: "SP" });
    const created_at = new Date();
    const updated_at = new Date(created_at.getTime() + 100);
    const priceRange = new PriceRange({
      model: "per_hour",
      min: 150,
      max: 250,
    });

    profile = new MusicianProfile({
      profile_id,
      musician_id,
      location,
      socialLinks: { instagram: "@test" },
      experience: 10,
      instruments: ["Guitar"],
      genres: ["Rock"],
      rating: 4.2,
      total_ratings: 10,
      created_at,
      updated_at,
      priceRange,
    });

    expect(profile.profile_id).toBe(profile_id);
    expect(profile.musician_id).toBe(musician_id);
    expect(profile.priceRange).toBe(priceRange);
    expect(profile.location).toBe(location);
    expect(profile.socialLinks).toEqual({ instagram: "@test" });
    expect(profile.experience).toBe(10);
    expect(profile.instruments).toEqual(["Guitar"]);
    expect(profile.genres).toEqual(["Rock"]);
    expect(profile.rating.value).toBe(4.2);
    expect(profile.total_ratings).toBe(10);
    expect(profile.created_at).toBe(created_at);
    expect(profile.updated_at).toBe(updated_at);
  });

  describe("create command", () => {
    test("should create a profile", () => {
      const musician_id = new Uuid();
      const profile = MusicianProfile.create({
        musician_id,
      });

      expect(profile.profile_id).toBeInstanceOf(MusicianProfileId);
      expect(profile.musician_id).toBe(musician_id);
      expect(profile.location).toBeInstanceOf(Location);
      expect(MusicianProfile.prototype.validate).toHaveBeenCalledTimes(1);
      expect(profile.notification.hasErrors()).toBe(false);
    });
  });

  test("should change location", () => {
    const profile = MusicianProfile.fake().aProfile().build();
    const oldUpdatedAt = profile.updated_at;
    const newLocation = new Location({ city: "Rio", state: "RJ" });

    profile.changeLocation(newLocation);

    expect(profile.location).toBe(newLocation);
    expect(profile.updated_at.getTime()).toBeGreaterThanOrEqual(
      oldUpdatedAt.getTime(),
    );
  });

  test("should change price range", () => {
    const profile = MusicianProfile.fake().aProfile().build();
    const priceRange = new PriceRange({
      model: "per_event",
      min: 500,
      max: 1000,
      notes: "Base fee",
    });

    profile.changePriceRange(priceRange);

    expect(profile.priceRange).toBe(priceRange);
    expect(profile.toJSON().priceRange).toEqual(priceRange.toJSON());
  });

  test("should update experience", () => {
    const profile = MusicianProfile.fake().aProfile().withExperience(0).build();
    profile.updateExperience(5);
    expect(profile.experience).toBe(5);
    expect(profile.notification.hasErrors()).toBe(false);
  });

  test("should not allow negative experience", () => {
    const profile = MusicianProfile.fake().aProfile().withExperience(1).build();
    profile.updateExperience(-1);
    expect(profile.experience).toBe(1);
    expect(profile.notification.hasErrors()).toBe(true);
  });

  test("should update instruments and genres", () => {
    const profile = MusicianProfile.fake().aProfile().build();
    profile.updateInstruments(["Guitar", "Vocals"]);
    profile.updateGenres(["Rock", "Pop"]);
    expect(profile.instruments).toEqual(["Guitar", "Vocals"]);
    expect(profile.genres).toEqual(["Rock", "Pop"]);
  });

  test("should update rating average", () => {
    const profile = MusicianProfile.fake()
      .aProfile()
      .withRating(0)
      .withTotalRatings(0)
      .build();
    profile.addRating(5);
    expect(profile.total_ratings).toBe(1);
    expect(profile.rating.value).toBe(5);

    profile.addRating(3);
    expect(profile.total_ratings).toBe(2);
    expect(profile.rating.value).toBe(4);
  });

  test("should reject invalid rating", () => {
    const profile = MusicianProfile.fake().aProfile().build();
    profile.addRating(0);
    expect(profile.notification.hasErrors()).toBe(true);
  });
});
