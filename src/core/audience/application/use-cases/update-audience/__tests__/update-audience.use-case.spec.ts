import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { InvalidPhoneError } from "../../../../../shared/domain/value-objects/phone.vo";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceFakeBuilder } from "../../../../domain/audience-fake.builder";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { UpdateAudienceUseCase } from "../update-audience.use-case";

describe("UpdateAudienceUseCase Unit Tests", () => {
  let useCase: UpdateAudienceUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new UpdateAudienceUseCase(repository);
  });

  it("should update audience name", async () => {
    const audience = AudienceFakeBuilder.anAudience().build();
    await repository.insert(audience);

    const input = {
      id: audience.id.id,
      name: "New Name",
    };

    const output = await useCase.execute(input);

    expect(output.name).toBe("New Name");
    expect(output.id).toBe(audience.id.id);
    expect(repository.items[0].name).toBe("New Name");
  });

  it("should update audience nickname", async () => {
    const audience = AudienceFakeBuilder.anAudience().build();
    await repository.insert(audience);

    const input = {
      id: audience.id.id,
      nickname: "NewNickname",
    };

    const output = await useCase.execute(input);

    expect(output.nickname).toBe("NewNickname");
    expect(repository.items[0].nickname).toBe("NewNickname");
  });

  it("should remove audience nickname", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    await repository.insert(audience);

    const input = {
      id: audience.id.id,
      nickname: null,
    };

    const output = await useCase.execute(input);

    expect(output.nickname).toBeNull();
    expect(repository.items[0].nickname).toBeNull();
  });

  it("should update audience avatar", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    await repository.insert(audience);

    const input = {
      id: audience.id.id,
      avatar: "new-avatar.jpg",
    };

    const output = await useCase.execute(input);

    expect(output.avatar).toBe("new-avatar.jpg");
    expect(repository.items[0].avatar).toBe("new-avatar.jpg");
  });

  it("should update audience phone", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    await repository.insert(audience);

    const input = {
      id: audience.id.id,
      phone: "+5511888888888",
    };

    const output = await useCase.execute(input);

    expect(output.phone).toBe("+5511888888888");
    expect(repository.items[0].phone?.value).toBe("+5511888888888");
  });

  it("should remove audience phone", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    await repository.insert(audience);

    const input = {
      id: audience.id.id,
      phone: null,
    };

    const output = await useCase.execute(input);

    expect(output.phone).toBeNull();
    expect(repository.items[0].phone).toBeNull();
  });

  it("should update favorite genres", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    await repository.insert(audience);

    const newGenres = ["Rock", "Jazz", "Blues"];
    const input = {
      id: audience.id.id,
      favorite_genres: newGenres,
    };

    const output = await useCase.execute(input);

    expect(output.preferences.favorite_genres).toEqual(newGenres);
    expect(repository.items[0].favorite_genres).toEqual(newGenres);
  });

  it("should activate audience", async () => {
    const audience = AudienceFakeBuilder.anInactiveAudience().build();
    await repository.insert(audience);

    const input = {
      id: audience.id.id,
      is_active: true,
    };

    const output = await useCase.execute(input);

    expect(output.is_active).toBe(true);
    expect(repository.items[0].is_active).toBe(true);
  });

  it("should deactivate audience", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    await repository.insert(audience);

    const input = {
      id: audience.id.id,
      is_active: false,
    };

    const output = await useCase.execute(input);

    expect(output.is_active).toBe(false);
    expect(repository.items[0].is_active).toBe(false);
  });

  it("should throw error when audience not found", async () => {
    const input = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "New Name",
    };

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("should throw validation error when name is invalid", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    await repository.insert(audience);

    const input = {
      id: audience.id.id,
      name: "A",
    };

    await expect(useCase.execute(input)).rejects.toThrow(EntityValidationError);
  });

  it("should throw validation error when phone is invalid", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    await repository.insert(audience);

    const input = {
      id: audience.id.id,
      phone: "invalid",
    };

    await expect(useCase.execute(input)).rejects.toThrow(InvalidPhoneError);
  });

  it("should throw validation error when too many favorite genres", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    await repository.insert(audience);

    const tooManyGenres = Array.from({ length: 21 }, (_, i) => `Genre ${i}`);
    const input = {
      id: audience.id.id,
      favorite_genres: tooManyGenres,
    };

    await expect(useCase.execute(input)).rejects.toThrow(EntityValidationError);
  });

  it("should update multiple fields at once", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    await repository.insert(audience);

    const input = {
      id: audience.id.id,
      name: "Updated Name",
      nickname: "UpdatedNick",
      avatar: "updated-avatar.jpg",
      favorite_genres: ["Rock", "Metal"],
      is_active: false,
    };

    const output = await useCase.execute(input);

    expect(output.name).toBe("Updated Name");
    expect(output.nickname).toBe("UpdatedNick");
    expect(output.avatar).toBe("updated-avatar.jpg");
    expect(output.preferences.favorite_genres).toEqual(["Rock", "Metal"]);
    expect(output.is_active).toBe(false);
  });
});
