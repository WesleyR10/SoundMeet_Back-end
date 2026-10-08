import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Musician } from "../../../../domain/musician.aggregate";
import { PresentationAudio } from "../../../../domain/value-objects/presentation-audio.vo";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { IMusicianStorage } from "../../../ports/musician-storage.interface";
import { DeleteMusicianPresentationAudioUseCase } from "../delete-musician-presentation-audio.use-case";

function makeStorage(): jest.Mocked<IMusicianStorage> {
  return {
    putObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn().mockReturnValue("https://cdn.test/x"),
  };
}

describe("DeleteMusicianPresentationAudioUseCase Unit Tests", () => {
  let repo: MusicianInMemoryRepository;
  let storage: jest.Mocked<IMusicianStorage>;
  let useCase: DeleteMusicianPresentationAudioUseCase;
  let musician: Musician;

  beforeEach(async () => {
    repo = new MusicianInMemoryRepository();
    storage = makeStorage();
    useCase = new DeleteMusicianPresentationAudioUseCase(repo, storage);
    musician = Musician.fake().aMusician().build();
    await repo.insert(musician);
  });

  it("limpa o campo e apaga o objeto do bucket", async () => {
    musician.changePresentationAudio(
      new PresentationAudio({
        url: "https://cdn.test/musicians/x/presentation-audio/a.mp3",
        object_key: "musicians/x/presentation-audio/a.mp3",
        duration_seconds: 30,
      }),
    );
    await repo.update(musician);

    const output = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    expect(output.presentation_audio).toBeNull();
    expect(storage.deleteObject).toHaveBeenCalledWith({
      object_key: "musicians/x/presentation-audio/a.mp3",
    });

    const updated = await repo.findById(musician.musician_id);
    expect(updated?.presentation_audio).toBeNull();
  });

  // Idempotente: o único caminho até aqui é apertar "remover", e quem já não
  // tem áudio quer exatamente o estado que já tem.
  it("é idempotente para quem não tem áudio", async () => {
    const output = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    expect(output.presentation_audio).toBeNull();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it("não derruba a remoção se o bucket falhar — o campo já saiu do ar", async () => {
    musician.changePresentationAudio(
      new PresentationAudio({
        url: "https://cdn.test/musicians/x/presentation-audio/a.mp3",
        object_key: "musicians/x/presentation-audio/a.mp3",
        duration_seconds: 30,
      }),
    );
    await repo.update(musician);
    storage.deleteObject.mockRejectedValue(new Error("bucket fora do ar"));

    await expect(
      useCase.execute({ musician_id: musician.musician_id.id }),
    ).resolves.toMatchObject({ presentation_audio: null });
  });

  it("lança NotFoundError quando o músico não existe", async () => {
    await expect(
      useCase.execute({
        musician_id: "8a746e1c-4f2a-4a1b-9c8e-1a2b3c4d5e6f",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
