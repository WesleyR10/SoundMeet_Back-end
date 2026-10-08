import { ExternalServiceError } from "../../../../../shared/domain/errors/external-service.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Musician } from "../../../../domain/musician.aggregate";
import { PresentationAudio } from "../../../../domain/value-objects/presentation-audio.vo";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { IMusicianStorage } from "../../../ports/musician-storage.interface";
import {
  PRESENTATION_AUDIO_ALLOWED_MIME_TYPES,
  UploadMusicianPresentationAudioUseCase,
} from "../upload-musician-presentation-audio.use-case";

function makeStorage(): jest.Mocked<IMusicianStorage> {
  return {
    putObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest
      .fn()
      .mockImplementation((key: string) => `https://cdn.test/${key}`),
  };
}

function input(
  overrides: Partial<
    Parameters<UploadMusicianPresentationAudioUseCase["execute"]>[0]
  > = {},
) {
  return {
    musician_id: "8a746e1c-4f2a-4a1b-9c8e-1a2b3c4d5e6f",
    data: Buffer.from("fake-audio-bytes"),
    content_type: "audio/mpeg",
    file_size: 512 * 1024,
    duration_seconds: 32,
    ...overrides,
  };
}

describe("UploadMusicianPresentationAudioUseCase Unit Tests", () => {
  let repo: MusicianInMemoryRepository;
  let storage: jest.Mocked<IMusicianStorage>;
  let useCase: UploadMusicianPresentationAudioUseCase;
  let musician: Musician;

  beforeEach(async () => {
    repo = new MusicianInMemoryRepository();
    storage = makeStorage();
    useCase = new UploadMusicianPresentationAudioUseCase(repo, storage);
    musician = Musician.fake().aMusician().build();
    await repo.insert(musician);
  });

  it("publica o áudio e guarda URL, chave e duração", async () => {
    const output = await useCase.execute(
      input({ musician_id: musician.musician_id.id }),
    );

    expect(storage.putObject).toHaveBeenCalledTimes(1);
    const objectKey = storage.putObject.mock.calls[0][0].object_key as string;
    expect(objectKey).toMatch(
      new RegExp(
        `^musicians/${musician.musician_id.id}/presentation-audio/.+\\.mp3$`,
      ),
    );
    expect(output.presentation_audio).toEqual({
      url: `https://cdn.test/${objectKey}`,
      duration_seconds: 32,
      uploaded_at: expect.any(Date),
    });

    const updated = await repo.findById(musician.musician_id);
    // A chave fica no agregado mesmo sem sair no output — é ela que permite
    // apagar o objeto antigo na próxima troca.
    expect(updated?.presentation_audio?.object_key).toBe(objectKey);
  });

  it("grava no bucket o tipo DETECTADO, que é o que o controller apurou dos bytes", async () => {
    await useCase.execute(
      input({
        musician_id: musician.musician_id.id,
        content_type: "audio/wav",
      }),
    );

    expect(storage.putObject.mock.calls[0][0].content_type).toBe("audio/wav");
    expect(storage.putObject.mock.calls[0][0].object_key).toMatch(/\.wav$/);
  });

  /*
   * 🔴 O `file-type@21` devolve `audio/x-m4a` para o `.m4a` que sai de um
   * iPhone, e `audio/mp4` para outros contêineres. Aceitar só um dos dois
   * reprovaria metade dos arquivos legítimos — e o teste que fixasse apenas
   * `audio/mp4` passaria feliz.
   */
  it.each(PRESENTATION_AUDIO_ALLOWED_MIME_TYPES)("aceita %s", async (mime) => {
    await expect(
      useCase.execute(
        input({ musician_id: musician.musician_id.id, content_type: mime }),
      ),
    ).resolves.toBeDefined();
  });

  it.each(["audio/ogg", "audio/flac", "image/png", "application/pdf"])(
    "recusa %s com mensagem acionável",
    async (mime) => {
      await expect(
        useCase.execute(
          input({ musician_id: musician.musician_id.id, content_type: mime }),
        ),
      ).rejects.toThrow(EntityValidationError);

      expect(storage.putObject).not.toHaveBeenCalled();
    },
  );

  it("recusa áudio mais longo que o limite, dizendo quanto ele tem", async () => {
    const error = await useCase
      .execute(
        input({ musician_id: musician.musician_id.id, duration_seconds: 72 }),
      )
      .catch((e) => e);

    expect(error).toBeInstanceOf(EntityValidationError);
    expect(JSON.stringify(error.error)).toContain("1min12");
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  // 40,04s é o que um encoder devolve para um trecho cortado em "40 segundos".
  // Reprovar isso seria incompreensível para quem acabou de cortar o áudio.
  it("aceita 40,04s — arredonda antes de comparar", async () => {
    await expect(
      useCase.execute(
        input({
          musician_id: musician.musician_id.id,
          duration_seconds: 40.04,
        }),
      ),
    ).resolves.toBeDefined();
  });

  it("recusa áudio curto demais para dizer alguma coisa", async () => {
    await expect(
      useCase.execute(
        input({ musician_id: musician.musician_id.id, duration_seconds: 2 }),
      ),
    ).rejects.toThrow(EntityValidationError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("recusa quando a duração não pôde ser medida", async () => {
    await expect(
      useCase.execute(
        input({ musician_id: musician.musician_id.id, duration_seconds: null }),
      ),
    ).rejects.toThrow(EntityValidationError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("recusa arquivo acima do teto de tamanho", async () => {
    await expect(
      useCase.execute(
        input({
          musician_id: musician.musician_id.id,
          file_size: 11 * 1024 * 1024,
        }),
      ),
    ).rejects.toThrow(EntityValidationError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("lança NotFoundError quando o músico não existe", async () => {
    await expect(useCase.execute(input())).rejects.toThrow(NotFoundError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  /*
   * 🔴 O caso que o avatar resolve com `?? objectKey` e que aqui NÃO pode
   * passar: sem URL pública, o campo receberia a object key crua e o
   * `<audio src="musicians/...">` viraria um caminho relativo à página aberta,
   * 404 silencioso. Falhar aqui é o que transforma configuração errada em erro
   * visível — e o objeto recém-escrito é removido para não virar lixo.
   */
  it("falha alto (e limpa o objeto) quando o storage não tem URL pública", async () => {
    storage.getPublicUrl.mockReturnValue(null);

    await expect(
      useCase.execute(input({ musician_id: musician.musician_id.id })),
    ).rejects.toThrow(ExternalServiceError);

    const objectKey = storage.putObject.mock.calls[0][0].object_key;
    expect(storage.deleteObject).toHaveBeenCalledWith({
      object_key: objectKey,
    });

    const updated = await repo.findById(musician.musician_id);
    expect(updated?.presentation_audio).toBeNull();
  });

  it("apaga o áudio anterior DEPOIS de persistir o novo", async () => {
    musician.changePresentationAudio(
      new PresentationAudio({
        url: "https://cdn.test/musicians/x/presentation-audio/old.mp3",
        object_key: "musicians/x/presentation-audio/old.mp3",
        duration_seconds: 30,
      }),
    );
    await repo.update(musician);

    const updateSpy = jest.spyOn(repo, "update");

    await useCase.execute(input({ musician_id: musician.musician_id.id }));

    expect(storage.deleteObject).toHaveBeenCalledWith({
      object_key: "musicians/x/presentation-audio/old.mp3",
    });
    // Ordem: o banco tem que estar atualizado antes de o arquivo sumir, senão
    // uma falha no update deixaria a grade servindo URL morta.
    expect(updateSpy.mock.invocationCallOrder[0]).toBeLessThan(
      storage.deleteObject.mock.invocationCallOrder[0],
    );
  });

  it("não derruba o upload se a limpeza do objeto antigo falhar", async () => {
    musician.changePresentationAudio(
      new PresentationAudio({
        url: "https://cdn.test/musicians/x/presentation-audio/old.mp3",
        object_key: "musicians/x/presentation-audio/old.mp3",
        duration_seconds: 30,
      }),
    );
    await repo.update(musician);
    storage.deleteObject.mockRejectedValue(new Error("bucket fora do ar"));

    await expect(
      useCase.execute(input({ musician_id: musician.musician_id.id })),
    ).resolves.toBeDefined();
  });
});
