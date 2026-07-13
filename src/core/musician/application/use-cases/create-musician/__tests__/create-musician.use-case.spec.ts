import { EntityValidationError } from "@core/shared/domain/validators/validation.error";

import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { CreateMusicianUseCase } from "../create-musician.use-case";

describe("CreateMusicianUseCase Unit Tests", () => {
  let useCase: CreateMusicianUseCase;
  let repository: MusicianInMemoryRepository;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new CreateMusicianUseCase(repository);
  });

  it("should throw an error when aggregate is not valid", async () => {
    const input = {
      name: "t".repeat(256),
      email: "invalid-email",
      phone: "123456789",
      genres: ["Rock"],
      instruments: ["Guitar"],
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      EntityValidationError,
    );
  });

  describe("should create a musician", () => {
    const arrange = [
      {
        input: {
          name: "John Doe",
          email: "john@example.com",
          phone: "+5511999999999",
          genres: ["Rock"],
          instruments: ["Guitar"],
        },
        expected: {
          name: "John Doe",
          stage_name: null,
          email: "john@example.com",
          phone: "+5511999999999",
          bio: null,
          avatar: null,
          genres: ["Rock"],
          instruments: ["Guitar"],
          experience_years: 0,
          rating: 0,
          total_ratings: 0,
          is_active: true,
          is_verified: false,
          display_name: "John Doe",
          is_experienced: false,
          is_highly_rated: false,
        },
      },
      {
        input: {
          name: "Jane Smith",
          email: "jane@example.com",
          phone: "+5511888888888",
          genres: ["Jazz", "Blues"],
          instruments: ["Piano", "Violin"],
          stage_name: "Jazz Queen",
          bio: "Professional jazz musician",
          experience_years: 15,
        },
        expected: {
          name: "Jane Smith",
          stage_name: "Jazz Queen",
          email: "jane@example.com",
          phone: "+5511888888888",
          bio: "Professional jazz musician",
          avatar: null,
          genres: ["Jazz", "Blues"],
          instruments: ["Piano", "Violin"],
          experience_years: 15,
          rating: 0,
          total_ratings: 0,
          is_active: true,
          is_verified: false,
          display_name: "Jazz Queen",
          is_experienced: true,
          is_highly_rated: false,
        },
      },
      {
        input: {
          name: "Bob Wilson",
          email: "bob@example.com",
          phone: "+5511777777777",
          genres: ["Country"],
          instruments: ["Guitar"],
          stage_name: "Country Bob",
        },
        expected: {
          name: "Bob Wilson",
          stage_name: "Country Bob",
          display_name: "Country Bob",
          email: "bob@example.com",
          phone: "+5511777777777",
          bio: null,
          avatar: null,
          genres: ["Country"],
          instruments: ["Guitar"],
          experience_years: 0,
          rating: 0,
          total_ratings: 0,
          is_active: true,
          is_verified: false,
          is_experienced: false,
          is_highly_rated: false,
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const spyInsert = jest.spyOn(repository, "insert");
      const output = await useCase.execute(input);

      expect(spyInsert).toHaveBeenCalledTimes(1);
      expect(output).toStrictEqual({
        id: repository.items[0].musician_id.id,
        ...expected,
        profile: null,
        qr_code: expect.any(String),
        qr_customization: null,
        created_at: repository.items[0].created_at,
        updated_at: repository.items[0].updated_at,
      });
      expect(repository.items[0]).toBeInstanceOf(Musician);
      expect(repository.items[0].qr_code!.isValid).toBe(true);
    });
  });

  it("should create a musician and generate QR code", async () => {
    const input = {
      name: "Test Musician",
      email: "test@example.com",
      phone: "+5511555555555",
      genres: ["Rock"],
      instruments: ["Guitar"],
    };

    const output = await useCase.execute(input);
    const musician = repository.items[0];

    expect(output.qr_code).toBeDefined();
    expect(output.qr_code).toBe(musician.qr_code!.code);
    expect(musician.qr_code!.isValid).toBe(true);
  });
});
