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
    expect(profile.priceRanges).toEqual([]);
    expect(profile.location).toBeInstanceOf(Location);
    expect(profile.socialLinks).toBeNull();
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
      created_at,
      updated_at,
      priceRanges: [priceRange],
    });

    expect(profile.profile_id).toBe(profile_id);
    expect(profile.musician_id).toBe(musician_id);
    expect(profile.priceRanges).toEqual([priceRange]);
    expect(profile.location).toBe(location);
    expect(profile.socialLinks).toEqual({ instagram: "@test" });
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

  test("should change price ranges (one per model)", () => {
    const profile = MusicianProfile.fake().aProfile().build();
    const eventRange = new PriceRange({
      model: "per_event",
      min: 500,
      max: 1000,
      notes: "Base fee",
    });
    const hourRange = new PriceRange({
      model: "per_hour",
      min: 100,
      max: 200,
    });

    profile.changePriceRanges([eventRange, hourRange]);

    expect(profile.priceRanges).toEqual([eventRange, hourRange]);
    expect(profile.toJSON().priceRanges).toEqual([
      eventRange.toJSON(),
      hourRange.toJSON(),
    ]);
    expect(profile.notification.hasErrors()).toBe(false);
  });

  test("should reject duplicated price range models", () => {
    const profile = MusicianProfile.fake().aProfile().build();
    const first = new PriceRange({ model: "per_hour", min: 100, max: 200 });
    const duplicate = new PriceRange({ model: "per_hour", min: 300, max: 400 });

    profile.changePriceRanges([first, duplicate]);

    expect(profile.notification.hasErrors()).toBe(true);
    expect(profile.priceRanges).toEqual([]);
  });

  /*
   * 🔴 Gêneros, instrumentos e experiência são do `Musician`, e SÓ dele.
   *
   * Este agregado os duplicava sem ter coluna para eles: `PATCH .../profile`
   * com `experience` alterava a cópia daqui, respondia 200 e não gravava nada.
   * O teste trava a volta da cópia — por campo, por método e pelo `toJSON`.
   */
  test("não carrega gêneros, instrumentos nem experiência", () => {
    const profile = MusicianProfile.fake()
      .aProfile()
      .build() as unknown as Record<string, unknown>;

    for (const field of ["genres", "instruments", "experience"]) {
      expect(profile).not.toHaveProperty(field);
    }
    for (const method of [
      "updateGenres",
      "updateInstruments",
      "updateExperience",
    ]) {
      expect(profile[method]).toBeUndefined();
    }
    expect(
      Object.keys((profile as any).toJSON()).filter((key) =>
        ["genres", "instruments", "experience"].includes(key),
      ),
    ).toEqual([]);
  });
});
