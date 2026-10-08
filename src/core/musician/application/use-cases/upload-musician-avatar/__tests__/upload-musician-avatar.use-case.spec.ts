import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { IMusicianStorage } from "../../../ports/musician-storage.interface";
import { UploadMusicianAvatarUseCase } from "../upload-musician-avatar.use-case";

function makeStorage(): jest.Mocked<IMusicianStorage> {
  return {
    putObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest
      .fn()
      .mockImplementation((key: string) => `https://cdn.test/${key}`),
  };
}

describe("UploadMusicianAvatarUseCase Unit Tests", () => {
  let repo: MusicianInMemoryRepository;
  let storage: jest.Mocked<IMusicianStorage>;
  let useCase: UploadMusicianAvatarUseCase;

  beforeEach(() => {
    repo = new MusicianInMemoryRepository();
    storage = makeStorage();
    useCase = new UploadMusicianAvatarUseCase(repo, storage);
  });

  it("uploads the avatar and updates the musician with the public URL", async () => {
    const musician = Musician.fake().aMusician().build();
    await repo.insert(musician);

    const output = await useCase.execute({
      musician_id: musician.musician_id.id,
      data: Buffer.from("fake-image-bytes"),
      content_type: "image/jpeg",
      file_size: 1024,
    });

    expect(storage.putObject).toHaveBeenCalledTimes(1);
    const objectKey = storage.putObject.mock.calls[0][0].object_key as string;
    expect(objectKey).toMatch(
      new RegExp(`^musicians/${musician.musician_id.id}/avatar/.+\\.jpg$`),
    );
    expect(output.avatar).toBe(`https://cdn.test/${objectKey}`);

    const updated = await repo.findById(musician.musician_id);
    expect(updated?.avatar).toBe(output.avatar);
  });

  it("throws NotFoundError when the musician does not exist", async () => {
    await expect(
      useCase.execute({
        musician_id: "8a746e1c-4f2a-4a1b-9c8e-1a2b3c4d5e6f",
        data: Buffer.from("x"),
        content_type: "image/jpeg",
        file_size: 1024,
      }),
    ).rejects.toThrow(NotFoundError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("throws EntityValidationError when content type is not allowed", async () => {
    const musician = Musician.fake().aMusician().build();
    await repo.insert(musician);

    await expect(
      useCase.execute({
        musician_id: musician.musician_id.id,
        data: Buffer.from("x"),
        content_type: "application/pdf",
        file_size: 1024,
      }),
    ).rejects.toThrow(EntityValidationError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("throws EntityValidationError when file exceeds the maximum size", async () => {
    const musician = Musician.fake().aMusician().build();
    await repo.insert(musician);

    await expect(
      useCase.execute({
        musician_id: musician.musician_id.id,
        data: Buffer.from("x"),
        content_type: "image/png",
        file_size: 6 * 1024 * 1024,
      }),
    ).rejects.toThrow(EntityValidationError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  /*
   * 🔴 A foto anterior sai do bucket. Até out/2026 nenhum objeto era apagado:
   * cada troca deixava um arquivo órfão e pago.
   */
  describe("limpeza da foto anterior", () => {
    const upload = (id: string) =>
      useCase.execute({
        musician_id: id,
        data: Buffer.from("fake-image-bytes"),
        content_type: "image/png",
        file_size: 1024,
      });

    it("guarda a chave do objeto e não apaga nada no primeiro envio", async () => {
      const musician = Musician.fake().aMusician().build();
      await repo.insert(musician);

      await upload(musician.musician_id.id);

      const key = storage.putObject.mock.calls[0][0].object_key;
      expect((await repo.findById(musician.musician_id))!.avatar_key).toBe(key);
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it("na troca, apaga o objeto ANTERIOR — e só depois de gravar o novo", async () => {
      const musician = Musician.fake().aMusician().build();
      await repo.insert(musician);
      await upload(musician.musician_id.id);
      const firstKey = storage.putObject.mock.calls[0][0].object_key;

      const order: string[] = [];
      jest.spyOn(repo, "update").mockImplementation(async () => {
        order.push("update");
      });
      storage.deleteObject.mockImplementation(async () => {
        order.push("delete");
      });

      await upload(musician.musician_id.id);

      expect(storage.deleteObject).toHaveBeenCalledWith({
        object_key: firstKey,
      });
      expect(order).toEqual(["update", "delete"]);
    });

    it("se o update falhar, a foto antiga NÃO é apagada", async () => {
      const musician = Musician.fake().aMusician().build();
      await repo.insert(musician);
      await upload(musician.musician_id.id);
      jest.spyOn(repo, "update").mockRejectedValueOnce(new Error("db fora"));

      await expect(upload(musician.musician_id.id)).rejects.toThrow("db fora");

      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it("falha ao apagar a antiga não derruba a troca que deu certo", async () => {
      const musician = Musician.fake().aMusician().build();
      await repo.insert(musician);
      await upload(musician.musician_id.id);
      storage.deleteObject.mockRejectedValueOnce(new Error("bucket fora"));

      await expect(upload(musician.musician_id.id)).resolves.toBeDefined();
    });

    it("a chave não sai no output", async () => {
      const musician = Musician.fake().aMusician().build();
      await repo.insert(musician);

      const output = await upload(musician.musician_id.id);

      expect(output).not.toHaveProperty("avatar_key");
    });
  });
});
