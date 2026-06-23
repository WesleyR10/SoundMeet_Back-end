import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { AiAudioUploadId } from "../../../../domain/ai-audio-upload.aggregate";
import { AiAudioUploadInMemoryRepository } from "../../../../infra/db/in-memory/ai-audio-upload-in-memory.repository";
import { IAiAudioStorage } from "../../../ports/ai-audio-storage.interface";
import { CreateAiAudioUploadUseCase } from "../create-ai-audio-upload.use-case";

describe("CreateAiAudioUploadUseCase Unit Tests", () => {
  test("should create an upload and store the object", async () => {
    const repo = new AiAudioUploadInMemoryRepository();

    const storage: IAiAudioStorage = {
      putObject: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest.fn().mockReturnValue("https://cdn.test/file"),
    };

    const useCase = new CreateAiAudioUploadUseCase(
      repo,
      storage,
      10 * 1024 * 1024,
      ["audio/mpeg"],
    );

    const musician_id = new Uuid().id;
    const output = await useCase.execute({
      musician_id,
      original_filename: "song.mp3",
      content_type: "audio/mpeg",
      file_size: 123,
      data: Buffer.from("x"),
    });

    expect(output.musician_id).toBe(musician_id);
    expect(output.public_url).toBe("https://cdn.test/file");
    expect(storage.putObject).toHaveBeenCalled();

    const entity = await repo.findById(new AiAudioUploadId(output.id));
    expect(entity).toBeDefined();
  });
});
