import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Establishment } from "../../../../domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { IEstablishmentStorage } from "../../../ports/establishment-storage.interface";
import { DeleteEstablishmentCoverUseCase } from "../delete-establishment-cover.use-case";

function makeStorage(): jest.Mocked<IEstablishmentStorage> {
  return {
    putObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn().mockReturnValue(null),
  };
}

describe("DeleteEstablishmentCoverUseCase Unit Tests", () => {
  let repo: EstablishmentInMemoryRepository;
  let storage: jest.Mocked<IEstablishmentStorage>;
  let useCase: DeleteEstablishmentCoverUseCase;

  beforeEach(() => {
    repo = new EstablishmentInMemoryRepository();
    storage = makeStorage();
    useCase = new DeleteEstablishmentCoverUseCase(repo, storage);
  });

  it("clears the cover and removes the object from the storage", async () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withCover("https://cdn.test/c.jpg", "establishments/x/cover/c.jpg")
      .build();
    await repo.insert(establishment);

    const output = await useCase.execute({
      establishment_id: establishment.establishment_id.id,
    });

    expect(output.cover).toBeNull();
    expect(storage.deleteObject).toHaveBeenCalledWith({
      object_key: "establishments/x/cover/c.jpg",
    });

    const updated = await repo.findById(establishment.establishment_id);
    expect(updated?.cover).toBeNull();
    expect(updated?.cover_key).toBeNull();
  });

  it("is idempotent: no cover means nothing to delete, and no error", async () => {
    const establishment = Establishment.fake().anEstablishment().build();
    await repo.insert(establishment);

    const output = await useCase.execute({
      establishment_id: establishment.establishment_id.id,
    });

    expect(output.cover).toBeNull();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the establishment does not exist", async () => {
    await expect(
      useCase.execute({
        establishment_id: "8a746e1c-4f2a-4a1b-9c8e-1a2b3c4d5e6f",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
