import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { CreateAudienceUseCase } from "../create-audience.use-case";

describe("CreateAudienceUseCase Unit Tests", () => {
  let useCase: CreateAudienceUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new CreateAudienceUseCase(repository);
  });

  it("should create an audience", async () => {
    const input = {
      email: "user@example.com",
      name: "John Doe",
      nickname: "Johnny",
      avatar: "avatar.jpg",
      phone: "+5511999999999",
      favorite_genres: ["Rock", "Pop"],
      favorite_artists: ["The Beatles", "Queen"],
      is_active: true,
    };

    const output = await useCase.execute(input);

    expect(output.id).toBeDefined();
    expect(output.email).toBe("user@example.com");
    expect(output.name).toBe("John Doe");
    expect(output.nickname).toBe("Johnny");
    expect(output.avatar).toBe("avatar.jpg");
    expect(output.phone).toBe("+5511999999999");
    expect(output.preferences.favorite_genres).toEqual(["Rock", "Pop"]);
    expect(output.preferences.favorite_artists).toEqual([
      "The Beatles",
      "Queen",
    ]);
    expect(output.is_active).toBe(true);
    expect(output.points.total).toBe(0);
    expect(output.points.monthly).toBe(0);
    expect(output.level.level).toBe(1);
    expect(output.level_name).toBe("Iniciante Musical");
    expect(repository.items).toHaveLength(1);
  });

  it("should create an audience with minimal data", async () => {
    const input = {
      email: "user@example.com",
      name: "John Doe",
    };

    const output = await useCase.execute(input);

    expect(output.id).toBeDefined();
    expect(output.email).toBe("user@example.com");
    expect(output.name).toBe("John Doe");
    expect(output.nickname).toBeNull();
    expect(output.avatar).toBeNull();
    expect(output.phone).toBeNull();
    expect(output.preferences.favorite_genres).toEqual([]);
    expect(output.preferences.favorite_artists).toEqual([]);
    expect(output.is_active).toBe(true);
    expect(output.points.total).toBe(0);
    expect(output.points.monthly).toBe(0);
    expect(output.level.level).toBe(1);
    expect(output.level_name).toBe("Iniciante Musical");
    expect(repository.items).toHaveLength(1);
  });

  it("should throw error when email is invalid", async () => {
    const input = {
      email: "invalid-email",
      name: "John Doe",
    };

    await expect(useCase.execute(input)).rejects.toThrow();
    expect(repository.items).toHaveLength(0);
  });

  it("should throw error when name is too short", async () => {
    const input = {
      email: "user@example.com",
      name: "J",
    };

    await expect(useCase.execute(input)).rejects.toThrow();
    expect(repository.items).toHaveLength(0);
  });

  it("should throw error when phone is invalid", async () => {
    const input = {
      email: "user@example.com",
      name: "John Doe",
      phone: "invalid",
    };

    await expect(useCase.execute(input)).rejects.toThrow();
    expect(repository.items).toHaveLength(0);
  });

  it("should throw an error when favorite_genres contains invalid genres", async () => {
    const input = {
      name: "John Doe",
      email: "john@example.com",
      nickname: "johndoe",
      avatar: "avatar.jpg",
      phone: "+5511999999999",
      favorite_genres: ["InvalidGenre1", "InvalidGenre2"], // Gêneros inválidos
      favorite_artists: ["Artist 1", "Artist 2"],
      is_active: true,
    };

    await expect(useCase.execute(input)).rejects.toThrow();
    expect(repository.items).toHaveLength(0);
  });

  it("should create inactive audience", async () => {
    const input = {
      email: "user@example.com",
      name: "John Doe",
      is_active: false,
    };

    const output = await useCase.execute(input);

    expect(output.is_active).toBe(false);
    expect(repository.items).toHaveLength(1);
  });
});
