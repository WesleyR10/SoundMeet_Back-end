import { MusicianProfile } from "../musician-profile.aggregate";

describe("MusicianProfileFakeBuilder Unit Tests", () => {
  test("should create a profile", () => {
    const profile = MusicianProfile.fake().aProfile().build();
    expect(profile).toBeInstanceOf(MusicianProfile);
    expect(profile.profile_id).toBeDefined();
    expect(profile.musician_id).toBeDefined();
    expect(profile.location).toBeDefined();
    expect(profile.created_at).toBeInstanceOf(Date);
    expect(profile.updated_at).toBeInstanceOf(Date);
  });

  test("should create profiles", () => {
    const profiles = MusicianProfile.fake().theProfiles(2).build();
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toBeInstanceOf(MusicianProfile);
    expect(profiles[1]).toBeInstanceOf(MusicianProfile);
  });
});
