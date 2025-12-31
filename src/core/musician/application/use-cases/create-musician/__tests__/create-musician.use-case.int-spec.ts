import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { CreateMusicianInput } from "../create-musician.input";
import { CreateMusicianUseCase } from "../create-musician.use-case";

describe("CreateMusicianUseCase Integration Tests", () => {
  let useCase: CreateMusicianUseCase;
  let repository: MusicianInMemoryRepository;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new CreateMusicianUseCase(repository);
  });

  it("should create a musician with complete data", async () => {
    const input: CreateMusicianInput = {
      name: "John Doe",
      email: "john@example.com",
      phone: "11999999999",
      genres: ["Rock", "Blues"],
      instruments: ["Guitar", "Piano"],
      stage_name: "Johnny Rock",
      bio: "Professional musician with 10 years of experience",
      experience_years: 10,
    };

    const output = await useCase.execute(input);

    expect(repository.items).toHaveLength(1);
    const musician = repository.items[0];

    expect(musician).toBeInstanceOf(Musician);
    expect(musician.name).toBe(input.name);
    expect(musician.stage_name).toBe(input.stage_name);
    expect(musician.email.value).toBe(input.email);
    expect(musician.phone!.value).toBe(input.phone);
    expect(musician.bio).toBe(input.bio);
    expect(musician.genres).toEqual(input.genres);
    expect(musician.instruments).toEqual(input.instruments);
    expect(musician.experience_years).toBe(input.experience_years);
    expect(musician.is_active).toBe(true);
    expect(musician.is_verified).toBe(false);
    expect(musician.qr_code).toBeDefined();
    expect(musician.qr_code!.isValid).toBe(true);

    expect(output.id).toBe(musician.id.id);
    expect(output.name).toBe(musician.name);
    expect(output.email).toBe(musician.email.value);
    expect(output.qr_code).toBe(musician.qr_code!.code);
  });

  it("should create a musician with minimal required data", async () => {
    const input: CreateMusicianInput = {
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "11888888888",
      genres: ["Jazz"],
      instruments: ["Piano"],
    };

    const output = await useCase.execute(input);

    expect(repository.items).toHaveLength(1);
    const musician = repository.items[0];

    expect(musician.name).toBe(input.name);
    expect(musician.stage_name).toBeNull();
    expect(musician.bio).toBeNull();
    expect(musician.experience_years).toBe(0);
    expect(musician.rating.value).toBe(0);
    expect(musician.total_ratings).toBe(0);

    expect(output.stage_name).toBeNull();
    expect(output.bio).toBeNull();
    expect(output.experience_years).toBe(0);
    expect(output.rating).toBe(0);
    expect(output.total_ratings).toBe(0);
  });

  it("should create multiple musicians", async () => {
    const inputs: CreateMusicianInput[] = [
      {
        name: "Musician 1",
        email: "musician1@example.com",
        phone: "11777777777",
        genres: ["Rock"],
        instruments: ["Guitar"],
      },
      {
        name: "Musician 2",
        email: "musician2@example.com",
        phone: "11666666666",
        genres: ["Jazz"],
        instruments: ["Piano"],
      },
      {
        name: "Musician 3",
        email: "musician3@example.com",
        phone: "11555555555",
        genres: ["Blues"],
        instruments: ["Harmonica"],
      },
    ];

    for (const input of inputs) {
      await useCase.execute(input);
    }

    expect(repository.items).toHaveLength(3);

    const musicians = repository.items;
    expect(musicians[0].name).toBe("Musician 1");
    expect(musicians[1].name).toBe("Musician 2");
    expect(musicians[2].name).toBe("Musician 3");

    // Each musician should have unique QR codes
    const qrCodes = musicians.map((m) => m.qr_code!.code);
    const uniqueQrCodes = new Set(qrCodes);
    expect(uniqueQrCodes.size).toBe(3);
  });

  it("should persist musician with correct timestamps", async () => {
    const beforeCreation = new Date();

    const input: CreateMusicianInput = {
      name: "Time Test Musician",
      email: "timetest@example.com",
      phone: "11444444444",
      genres: ["Pop"],
      instruments: ["Vocals"],
    };

    await useCase.execute(input);

    const afterCreation = new Date();
    const musician = repository.items[0];

    expect(musician.created_at).toBeInstanceOf(Date);
    expect(musician.created_at.getTime()).toBeGreaterThanOrEqual(
      beforeCreation.getTime(),
    );
    expect(musician.created_at.getTime()).toBeLessThanOrEqual(
      afterCreation.getTime(),
    );
  });
});
