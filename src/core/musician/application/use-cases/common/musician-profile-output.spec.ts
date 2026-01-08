import { Musician } from "../../../domain/musician.aggregate";
import { MusicianOutputMapper } from "./musician-profile-output";

describe("MusicianOutputMapper Unit Tests", () => {
  it("should convert a musician in output", () => {
    const entity = Musician.create({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    const output = MusicianOutputMapper.toOutput(entity);
    expect(output).toStrictEqual({
      id: entity.musician_id.id,
      email: "john@example.com",
      name: "John Doe",
      stage_name: null,
      bio: null,
      avatar: null,
      phone: null,
      genres: ["Rock"],
      instruments: ["Guitar"],
      experience_years: 0,
      qr_code: entity.qr_code?.code || null,
      rating: 0,
      total_ratings: 0,
      is_active: true,
      is_verified: false,
      profile: null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      display_name: "John Doe",
      is_experienced: false,
      is_highly_rated: false,
    });
  });

  it("should convert a musician with all fields in output", () => {
    const entity = Musician.create({
      name: "Jane Smith",
      email: "jane@example.com",
      stage_name: "Jane Rock",
      bio: "Professional musician",
      avatar: "https://example.com/avatar.jpg",
      phone: "+5511999999999",
      genres: ["Rock", "Pop"],
      instruments: ["Guitar", "Piano"],
      experience_years: 10,
      is_active: true,
    });
    const output = MusicianOutputMapper.toOutput(entity);
    expect(output).toStrictEqual({
      id: entity.musician_id.id,
      email: "jane@example.com",
      name: "Jane Smith",
      stage_name: "Jane Rock",
      bio: "Professional musician",
      avatar: "https://example.com/avatar.jpg",
      phone: "+5511999999999",
      genres: ["Rock", "Pop"],
      instruments: ["Guitar", "Piano"],
      experience_years: 10,
      qr_code: entity.qr_code?.code || null,
      rating: 0,
      total_ratings: 0,
      is_active: true,
      is_verified: false,
      profile: null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      display_name: "Jane Rock",
      is_experienced: true,
      is_highly_rated: false,
    });
  });
});
