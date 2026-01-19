import { EstablishmentProfile } from "../establishment-profile.aggregate";

describe("EstablishmentProfileFakeBuilder Unit Tests", () => {
  test("should create a profile", () => {
    const profile = EstablishmentProfile.fake().aProfile().build();
    expect(profile).toBeInstanceOf(EstablishmentProfile);
    expect(profile.profile_id).toBeDefined();
    expect(profile.establishment_id).toBeDefined();

    expect(profile.capacity).toBeNull();
    expect(profile.location).toBeDefined();

    expect(profile.amenities).toEqual(["sound_system"]);
    expect(profile.preferredGenres).toEqual(["Rock"]);
    expect(profile.operatingHours).toBeNull();
    expect(profile.priceRange).toBeNull();
    expect(profile.socialLinks).toBeNull();

    expect(profile.created_at).toBeInstanceOf(Date);
    expect(profile.updated_at).toBeInstanceOf(Date);
  });

  test("withInstagram should set social links", () => {
    const profile = EstablishmentProfile.fake()
      .aProfile()
      .withInstagram("soundmeet")
      .build();

    expect(profile.socialLinks).not.toBeNull();
    expect(profile.socialLinks!.links).toHaveLength(1);
    expect(profile.socialLinks!.links[0]).toStrictEqual({
      platform: "instagram",
      username: "soundmeet",
      url: "https://www.instagram.com/soundmeet",
    });
  });

  test("should create profiles", () => {
    const profiles = EstablishmentProfile.fake().theProfiles(2).build();
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toBeInstanceOf(EstablishmentProfile);
    expect(profiles[1]).toBeInstanceOf(EstablishmentProfile);
  });
});
