import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { DeleteEstablishmentUseCase } from "../delete-establishment.use-case";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import {
  Establishment,
  EstablishmentId,
} from "../../../../domain/establishment.aggregate";
import { EstablishmentFakeBuilder } from "../../../../domain/establishment-fake.builder";

describe("DeleteEstablishmentUseCase Unit Tests", () => {
  let useCase: DeleteEstablishmentUseCase;
  let repository: EstablishmentInMemoryRepository;

  beforeEach(() => {
    repository = new EstablishmentInMemoryRepository();
    useCase = new DeleteEstablishmentUseCase(repository);
  });

  it("should throw an error when establishment not found", async () => {
    const establishmentId = new EstablishmentId();
    const input = {
      id: establishmentId.id,
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(establishmentId.id, Establishment),
    );
  });

  it("should delete an establishment", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment];

    const input = {
      id: establishment.id.id,
    };

    await useCase.execute(input);

    const deletedEstablishment = await repository.findById(establishment.id);
    expect(deletedEstablishment).toBeNull();
  });

  it("should remove establishment from repository items", async () => {
    const establishment1 = EstablishmentFakeBuilder.anEstablishment().build();
    const establishment2 = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment1, establishment2];

    const input = {
      id: establishment1.id.id,
    };

    await useCase.execute(input);

    expect(repository.items).toHaveLength(1);
    expect(repository.items[0].id.id).toBe(establishment2.id.id);
  });

  it("should handle multiple delete operations", async () => {
    const establishment1 = EstablishmentFakeBuilder.anEstablishment().build();
    const establishment2 = EstablishmentFakeBuilder.anEstablishment().build();
    const establishment3 = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment1, establishment2, establishment3];

    // Delete first establishment
    await useCase.execute({ id: establishment1.id.id });
    expect(repository.items).toHaveLength(2);

    // Delete second establishment
    await useCase.execute({ id: establishment2.id.id });
    expect(repository.items).toHaveLength(1);
    expect(repository.items[0].id.id).toBe(establishment3.id.id);

    // Delete third establishment
    await useCase.execute({ id: establishment3.id.id });
    expect(repository.items).toHaveLength(0);
  });

  it("should not affect other establishments when deleting one", async () => {
    const establishment1 = EstablishmentFakeBuilder.anEstablishment()
      .withName("Bar 1")
      .build();
    const establishment2 = EstablishmentFakeBuilder.anEstablishment()
      .withName("Bar 2")
      .build();
    repository.items = [establishment1, establishment2];

    const input = {
      id: establishment1.id.id,
    };

    await useCase.execute(input);

    const remainingEstablishment = await repository.findById(
      new EstablishmentId(establishment2.id.id),
    );
    expect(remainingEstablishment).toBeDefined();
    expect(remainingEstablishment!.name).toBe("Bar 2");
  });

  it("should throw error when trying to delete same establishment twice", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment];

    const input = {
      id: establishment.id.id,
    };

    // First deletion should succeed
    await useCase.execute(input);

    // Second deletion should throw error
    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(establishment.id.id, Establishment),
    );
  });
});
