import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { DeleteAudienceUseCase } from "../delete-audience.use-case";

describe("DeleteAudienceUseCase Unit Tests", () => {
  let useCase: DeleteAudienceUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new DeleteAudienceUseCase(repository);
  });

  it("should delete an audience", async () => {
    const audience = Audience.fake().build();
    await repository.insert(audience);

    expect(repository.items).toHaveLength(1);

    await useCase.execute({ id: audience.id.id });

    expect(repository.items).toHaveLength(0);
  });

  it("should throw error when audience not found", async () => {
    const audienceId = new Uuid();

    await expect(useCase.execute({ id: audienceId.id })).rejects.toThrow(
      new NotFoundError(audienceId.id, Audience),
    );
  });

  it("should throw error when id is invalid", async () => {
    const invalidId = "invalid-uuid";

    await expect(useCase.execute({ id: invalidId })).rejects.toThrow(
      InvalidUuidError,
    );
  });

  it("should delete audience with points and interactions", async () => {
    const audience = Audience.fake().withTotalPoints(100).build();
    await repository.insert(audience);

    expect(repository.items).toHaveLength(1);
    expect(repository.items[0].totalPoints).toBeGreaterThan(0);

    await useCase.execute({ id: audience.id.id });

    expect(repository.items).toHaveLength(0);
  });

  it("should delete inactive audience", async () => {
    const audience = Audience.fake().deactivate().build();
    await repository.insert(audience);

    expect(repository.items).toHaveLength(1);
    expect(repository.items[0].is_active).toBe(false);

    await useCase.execute({ id: audience.id.id });

    expect(repository.items).toHaveLength(0);
  });

  it("should delete audience without phone and nickname", async () => {
    const audience = Audience.fake().withNickname(null).withPhone(null).build();
    await repository.insert(audience);

    expect(repository.items).toHaveLength(1);
    expect(repository.items[0].nickname).toBeNull();
    expect(repository.items[0].phone).toBeNull();

    await useCase.execute({ id: audience.id.id });

    expect(repository.items).toHaveLength(0);
  });
});
