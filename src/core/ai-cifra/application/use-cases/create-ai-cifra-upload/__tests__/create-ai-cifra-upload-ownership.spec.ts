import { ForbiddenException } from "@nestjs/common";
import { Readable } from "stream";

import { AiCifraUploadInMemoryRepository } from "../../../../infra/db/in-memory/ai-cifra-upload-in-memory.repository";
import { MusicLibraryOwnershipChecker } from "../../../../infra/ownership/music-library-ownership.checker";
import { CreateAiCifraUploadUseCase } from "../create-ai-cifra-upload.use-case";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OUTSIDER = "22222222-2222-4222-8222-222222222222";
const LIBRARY_ITEM = "33333333-3333-4333-8333-333333333333";

const storageStub = {
  putObject: jest.fn().mockResolvedValue(undefined),
  getPublicUrl: (key: string) => `https://cdn.test/${key}`,
} as never;

const input = (musician_id: string, music_library_id?: string) => ({
  musician_id,
  music_library_id: music_library_id ?? null,
  original_filename: "song.mp3",
  content_type: "audio/mpeg",
  file_size: 1024,
  data: Readable.from(["fake-audio"]),
});

// Catálogo com um único item, pertencente a OWNER.
const getMusicLibraryStub = {
  execute: async ({ id }: { id: string }) => {
    if (id !== LIBRARY_ITEM) {
      throw new Error("NotFound");
    }
    return { musician_id: OWNER };
  },
};

function makeUseCase() {
  return new CreateAiCifraUploadUseCase(
    new AiCifraUploadInMemoryRepository(),
    storageStub,
    70 * 1024 * 1024,
    ["audio/mpeg"],
    new MusicLibraryOwnershipChecker(getMusicLibraryStub),
  );
}

describe("CreateAiCifraUploadUseCase — ownership do music_library_id", () => {
  it("aceita vincular item do próprio catálogo", async () => {
    const output = await makeUseCase().execute(input(OWNER, LIBRARY_ITEM));
    expect(output.music_library_id).toBe(LIBRARY_ITEM);
  });

  it("recusa vincular item de catálogo de outro músico", async () => {
    await expect(
      makeUseCase().execute(input(OUTSIDER, LIBRARY_ITEM)),
    ).rejects.toThrow(ForbiddenException);
  });

  it("trata item inexistente como proibido (não diferencia de 404)", async () => {
    await expect(
      makeUseCase().execute(
        input(OWNER, "44444444-4444-4444-8444-444444444444"),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("segue funcionando sem music_library_id", async () => {
    const output = await makeUseCase().execute(input(OWNER));
    expect(output.music_library_id).toBeNull();
    expect(output.musician_id).toBe(OWNER);
  });
});
