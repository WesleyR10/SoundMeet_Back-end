import { MusicLibraryCatalogService } from "../music-library.service";

describe("MusicLibraryCatalogService", () => {
  let createUseCase: { execute: jest.Mock };
  let getUseCase: { execute: jest.Mock };
  let listUseCase: { execute: jest.Mock };
  let updateUseCase: { execute: jest.Mock };
  let service: MusicLibraryCatalogService;

  beforeEach(() => {
    createUseCase = { execute: jest.fn() };
    getUseCase = { execute: jest.fn() };
    listUseCase = { execute: jest.fn() };
    updateUseCase = { execute: jest.fn() };
    service = new MusicLibraryCatalogService(
      createUseCase as any,
      getUseCase as any,
      listUseCase as any,
      updateUseCase as any,
    );
  });

  it("reuses an existing YouTube catalog item", async () => {
    listUseCase.execute.mockResolvedValue({
      items: [
        {
          id: "music-library-id",
          source: "youtube",
          source_id: "video-id",
        },
      ],
    });

    const output = await service.findOrCreateYoutube({
      musician_id: "musician-id",
      title: "Song",
      artist: "Artist",
      youtube_video_id: "video-id",
    });

    expect(output).toEqual({
      item: expect.objectContaining({ id: "music-library-id" }),
      reused: true,
    });
    expect(createUseCase.execute).not.toHaveBeenCalled();
  });

  it("creates a YouTube catalog item when no existing item is found", async () => {
    listUseCase.execute.mockResolvedValue({ items: [] });
    createUseCase.execute.mockResolvedValue({ id: "created-id" });

    const output = await service.findOrCreateYoutube({
      musician_id: "musician-id",
      title: "Song",
      artist: "Artist",
      youtube_video_id: "video-id",
    });

    expect(createUseCase.execute).toHaveBeenCalledWith({
      musician_id: "musician-id",
      title: "Song",
      artist: "Artist",
      source: "youtube",
      source_id: "video-id",
    });
    expect(output).toEqual({
      item: { id: "created-id" },
      reused: false,
    });
  });

  it("updates source only when the item belongs to the musician", async () => {
    getUseCase.execute.mockResolvedValue({
      id: "music-library-id",
      musician_id: "musician-id",
    });
    updateUseCase.execute.mockResolvedValue({ id: "music-library-id" });

    const output = await service.updateCatalogSource({
      id: "music-library-id",
      musician_id: "musician-id",
      source: "musify",
      source_id: "source-id",
    });

    expect(updateUseCase.execute).toHaveBeenCalledWith({
      id: "music-library-id",
      title: undefined,
      artist: undefined,
      source: "musify",
      source_id: "source-id",
    });
    expect(output).toEqual({ id: "music-library-id" });
  });

  it("does not update source when the item belongs to another musician", async () => {
    getUseCase.execute.mockResolvedValue({
      id: "music-library-id",
      musician_id: "other-musician-id",
    });

    const output = await service.updateCatalogSource({
      id: "music-library-id",
      musician_id: "musician-id",
      source: "musify",
      source_id: "source-id",
    });

    expect(output).toBeNull();
    expect(updateUseCase.execute).not.toHaveBeenCalled();
  });
});
