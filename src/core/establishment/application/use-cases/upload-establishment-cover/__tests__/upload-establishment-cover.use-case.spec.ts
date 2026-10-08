import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Establishment } from "../../../../domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { IEstablishmentStorage } from "../../../ports/establishment-storage.interface";
import { UploadEstablishmentCoverUseCase } from "../upload-establishment-cover.use-case";

function makeStorage(): jest.Mocked<IEstablishmentStorage> {
  return {
    putObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest
      .fn()
      .mockImplementation((key: string) => `https://cdn.test/${key}`),
  };
}

describe("UploadEstablishmentCoverUseCase Unit Tests", () => {
  let repo: EstablishmentInMemoryRepository;
  let storage: jest.Mocked<IEstablishmentStorage>;
  let useCase: UploadEstablishmentCoverUseCase;

  beforeEach(() => {
    repo = new EstablishmentInMemoryRepository();
    storage = makeStorage();
    useCase = new UploadEstablishmentCoverUseCase(repo, storage);
  });

  it("uploads the cover and stores BOTH the public URL and the object key", async () => {
    const establishment = Establishment.fake().anEstablishment().build();
    await repo.insert(establishment);

    const output = await useCase.execute({
      establishment_id: establishment.establishment_id.id,
      data: Buffer.from("fake-image-bytes"),
      content_type: "image/webp",
      file_size: 2048,
    });

    expect(storage.putObject).toHaveBeenCalledTimes(1);
    const objectKey = storage.putObject.mock.calls[0][0].object_key as string;
    expect(objectKey).toMatch(
      new RegExp(
        `^establishments/${establishment.establishment_id.id}/cover/.+\\.webp$`,
      ),
    );
    expect(output.cover).toBe(`https://cdn.test/${objectKey}`);

    const updated = await repo.findById(establishment.establishment_id);
    expect(updated?.cover).toBe(output.cover);
    /*
     * 🔴 A chave é o que torna a faxina possível. Sem ela gravada, a troca de
     * capa do teste abaixo não teria o que apagar — e o defeito só apareceria
     * na conta do bucket, meses depois.
     */
    expect(updated?.cover_key).toBe(objectKey);
  });

  it("🔴 deletes the PREVIOUS object when the cover is replaced", async () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withCover("https://cdn.test/old.jpg", "establishments/x/cover/old.jpg")
      .build();
    await repo.insert(establishment);

    await useCase.execute({
      establishment_id: establishment.establishment_id.id,
      data: Buffer.from("new-bytes"),
      content_type: "image/png",
      file_size: 512,
    });

    expect(storage.deleteObject).toHaveBeenCalledWith({
      object_key: "establishments/x/cover/old.jpg",
    });
  });

  it("⚠️ concludes even when deleting the previous object fails", async () => {
    // A capa NOVA já está gravada quando a faxina roda. Relançar aqui diria ao
    // dono que a troca falhou quando ela deu certo.
    storage.deleteObject.mockRejectedValueOnce(new Error("S3 down"));

    const establishment = Establishment.fake()
      .anEstablishment()
      .withCover("https://cdn.test/old.jpg", "establishments/x/cover/old.jpg")
      .build();
    await repo.insert(establishment);

    const output = await useCase.execute({
      establishment_id: establishment.establishment_id.id,
      data: Buffer.from("new-bytes"),
      content_type: "image/jpeg",
      file_size: 512,
    });

    expect(output.cover).not.toBe("https://cdn.test/old.jpg");
  });

  it("does not touch the storage when the file is too large", async () => {
    const establishment = Establishment.fake().anEstablishment().build();
    await repo.insert(establishment);

    await expect(
      useCase.execute({
        establishment_id: establishment.establishment_id.id,
        data: Buffer.from("x"),
        content_type: "image/jpeg",
        file_size: 4 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow(EntityValidationError);

    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("rejects a content type outside the allowlist", async () => {
    const establishment = Establishment.fake().anEstablishment().build();
    await repo.insert(establishment);

    await expect(
      useCase.execute({
        establishment_id: establishment.establishment_id.id,
        data: Buffer.from("x"),
        content_type: "image/svg+xml",
        file_size: 128,
      }),
    ).rejects.toThrow(EntityValidationError);

    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the establishment does not exist", async () => {
    await expect(
      useCase.execute({
        establishment_id: "8a746e1c-4f2a-4a1b-9c8e-1a2b3c4d5e6f",
        data: Buffer.from("x"),
        content_type: "image/jpeg",
        file_size: 128,
      }),
    ).rejects.toThrow(NotFoundError);

    expect(storage.putObject).not.toHaveBeenCalled();
  });
});
