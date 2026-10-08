import { SyncedLyrics } from "../../../../domain/synced-lyrics.aggregate";
import { AlignSyncedLyricsWordTimestampsUseCase } from "../align-synced-lyrics-word-timestamps.use-case";

describe("AlignSyncedLyricsWordTimestampsUseCase Unit Tests", () => {
  it("should apply real word timestamps returned by the alignment client", async () => {
    // fake builder default: "[00:00.00]Hello\n[00:01.00]World\n"
    const entity = SyncedLyrics.fake().aSyncedLyrics().build();

    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const client = {
      align: jest.fn().mockResolvedValue({
        lines: [
          {
            index: 0,
            words: [{ text: "Hello", start_ms: 0, end_ms: 400 }],
          },
        ],
      }),
    } as any;

    const useCase = new AlignSyncedLyricsWordTimestampsUseCase(repo, client);

    await useCase.execute({
      music_library_id: entity.music_library_id.id,
      audio_object_key: "uploads/some-object-key.mp3",
    });

    expect(client.align).toHaveBeenCalledWith(
      expect.objectContaining({
        input_object_key: "uploads/some-object-key.mp3",
        lines: expect.arrayContaining([
          expect.objectContaining({ index: 0, text: "Hello" }),
          expect.objectContaining({ index: 1, text: "World" }),
        ]),
      }),
    );
    expect(entity.lrc_has_word_timestamps).toBe(true);
    expect(entity.lrc_normalized?.lines[0].words).toEqual([
      { text: "Hello", start_ms: 0, end_ms: 400 },
    ]);
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it("should be a no-op when the entity has no synced lyrics yet", async () => {
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withLrcRaw(() => null)
      .withLrcProvider(() => null)
      .build();

    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;

    const client = { align: jest.fn() } as any;

    const useCase = new AlignSyncedLyricsWordTimestampsUseCase(repo, client);
    await useCase.execute({
      music_library_id: entity.music_library_id.id,
      audio_object_key: "uploads/some-object-key.mp3",
    });

    expect(client.align).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("should be a no-op when the entity is not found", async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;
    const client = { align: jest.fn() } as any;

    const useCase = new AlignSyncedLyricsWordTimestampsUseCase(repo, client);
    await useCase.execute({
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      audio_object_key: "uploads/some-object-key.mp3",
    });

    expect(client.align).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("should not persist when the client returns no aligned lines", async () => {
    const entity = SyncedLyrics.fake().aSyncedLyrics().build();
    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;
    const client = { align: jest.fn().mockResolvedValue({ lines: [] }) } as any;

    const useCase = new AlignSyncedLyricsWordTimestampsUseCase(repo, client);
    await useCase.execute({
      music_library_id: entity.music_library_id.id,
      audio_object_key: "uploads/some-object-key.mp3",
    });

    expect(repo.update).not.toHaveBeenCalled();
    expect(entity.lrc_has_word_timestamps).toBe(false);
  });

  it("should propagate errors from the alignment client (caller decides best-effort handling)", async () => {
    const entity = SyncedLyrics.fake().aSyncedLyrics().build();
    const repo = {
      findById: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;
    const client = {
      align: jest.fn().mockRejectedValue(new Error("worker unavailable")),
    } as any;

    const useCase = new AlignSyncedLyricsWordTimestampsUseCase(repo, client);

    await expect(
      useCase.execute({
        music_library_id: entity.music_library_id.id,
        audio_object_key: "uploads/some-object-key.mp3",
      }),
    ).rejects.toThrow("worker unavailable");
    expect(repo.update).not.toHaveBeenCalled();
  });
});
