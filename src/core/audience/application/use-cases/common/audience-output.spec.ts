import { describe, it } from "@jest/globals";
import { Audience } from "../../../domain/audience.aggregate";
import { AudienceOutputMapper } from "./audience-output";

describe("AudienceOutputMapper Unit Tests", () => {
  it("should convert an audience to output", () => {
    const audience = Audience.fake().build();
    const output = AudienceOutputMapper.toOutput(audience);

    expect(output.id).toBe(audience.id.id);
    expect(output.email).toBe(audience.email?.value ?? null);
    expect(output.name).toBe(audience.name);
    expect(output.nickname).toBe(audience.nickname);
    expect(output.avatar).toBe(audience.avatar);
    expect(output.phone).toBe(audience.phone?.value ?? null);
    expect(output.preferences.favorite_genres).toEqual(
      audience.preferences?.favoriteGenres ?? [],
    );
    expect(output.preferences.favorite_artists).toEqual(
      audience.preferences?.favoriteArtists ?? [],
    );
    expect(output.points.monthly).toBe(audience.monthlyPoints ?? 0);
    expect(output.level.level).toBe(audience.level?.level ?? 1);
    expect(output.level.name).toBe(audience.level?.name ?? "Iniciante");
    expect(output.is_active).toBe(audience.is_active);
    expect(output.created_at).toBe(audience.created_at);
  });

  it("should handle audience without phone and nickname", () => {
    const audience = Audience.fake().withNickname(null).withPhone(null).build();
    const output = AudienceOutputMapper.toOutput(audience);

    expect(output.phone).toBeNull();
    expect(output.nickname).toBeNull();
  });
});
