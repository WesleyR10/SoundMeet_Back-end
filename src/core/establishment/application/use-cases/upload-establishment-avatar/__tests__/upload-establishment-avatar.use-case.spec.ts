import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Establishment } from "../../../../domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { IEstablishmentStorage } from "../../../ports/establishment-storage.interface";
import { UploadEstablishmentAvatarUseCase } from "../upload-establishment-avatar.use-case";

function makeStorage(): jest.Mocked<IEstablishmentStorage> {
  return {
    putObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest
      .fn()
      .mockImplementation((key: string) => `https://cdn.test/${key}`),
  };
}

describe("UploadEstablishmentAvatarUseCase Unit Tests", () => {
  let repo: EstablishmentInMemoryRepository;
  let storage: jest.Mocked<IEstablishmentStorage>;
  let useCase: UploadEstablishmentAvatarUseCase;

  beforeEach(() => {
    repo = new EstablishmentInMemoryRepository();
    storage = makeStorage();
    useCase = new UploadEstablishmentAvatarUseCase(repo, storage);
  });

  it("uploads the photo and stores BOTH the public URL and the object key", async () => {
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
        `^establishments/${establishment.establishment_id.id}/avatar/.+\\.webp$`,
      ),
    );
    expect(output.avatar).toBe(`https://cdn.test/${objectKey}`);

    const updated = await repo.findById(establishment.establishment_id);
    expect(updated?.avatar).toBe(output.avatar);
    // 🔴 Sem a chave gravada, a próxima troca não teria o que apagar.
    expect(updated?.avatar_key).toBe(objectKey);
  });

  it("does not leak the object key in the output", async () => {
    const establishment = Establishment.fake().anEstablishment().build();
    await repo.insert(establishment);

    const output = await useCase.execute({
      establishment_id: establishment.establishment_id.id,
      data: Buffer.from("bytes"),
      content_type: "image/png",
      file_size: 256,
    });

    // `GET /establishments/:id` é @Public(): a chave é endereço interno.
    expect(output).not.toHaveProperty("avatar_key");
  });

  it("🔴 deletes the PREVIOUS object when the photo is replaced", async () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withAvatarImage(
        "https://cdn.test/old.jpg",
        "establishments/x/avatar/old.jpg",
      )
      .build();
    await repo.insert(establishment);

    await useCase.execute({
      establishment_id: establishment.establishment_id.id,
      data: Buffer.from("new-bytes"),
      content_type: "image/png",
      file_size: 512,
    });

    expect(storage.deleteObject).toHaveBeenCalledWith({
      object_key: "establishments/x/avatar/old.jpg",
    });
  });

  it("⚠️ legacy avatar (URL without key) is replaced WITHOUT touching the storage", async () => {
    // Linha gravada pelo PATCH antigo: a URL não era objeto nosso. Tratar a URL
    // como chave apagaria — na melhor hipótese — nada, e na pior um objeto
    // alheio que por acaso tivesse aquele caminho.
    const establishment = Establishment.fake()
      .anEstablishment()
      .withAvatar("https://example.com/logo.png")
      .build();
    await repo.insert(establishment);

    const output = await useCase.execute({
      establishment_id: establishment.establishment_id.id,
      data: Buffer.from("new-bytes"),
      content_type: "image/jpeg",
      file_size: 512,
    });

    expect(output.avatar).toMatch(/^https:\/\/cdn\.test\//);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it("⚠️ concludes even when deleting the previous object fails", async () => {
    storage.deleteObject.mockRejectedValueOnce(new Error("S3 down"));

    const establishment = Establishment.fake()
      .anEstablishment()
      .withAvatarImage(
        "https://cdn.test/old.jpg",
        "establishments/x/avatar/old.jpg",
      )
      .build();
    await repo.insert(establishment);

    const output = await useCase.execute({
      establishment_id: establishment.establishment_id.id,
      data: Buffer.from("new-bytes"),
      content_type: "image/jpeg",
      file_size: 512,
    });

    expect(output.avatar).not.toBe("https://cdn.test/old.jpg");
  });

  it("does not touch the storage when the file is too large", async () => {
    const establishment = Establishment.fake().anEstablishment().build();
    await repo.insert(establishment);

    await expect(
      useCase.execute({
        establishment_id: establishment.establishment_id.id,
        data: Buffer.from("x"),
        content_type: "image/jpeg",
        file_size: 2 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow(EntityValidationError);

    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("rejects SVG — a document with script, not an image", async () => {
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
