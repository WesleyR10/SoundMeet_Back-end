import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import {
  IAiCifraCatalogSearchClient,
  SearchAiCifraCatalogUseCase,
} from "../search-ai-cifra-catalog.use-case";

describe("SearchAiCifraCatalogUseCase", () => {
  it("busca via client com limit default quando não informado", async () => {
    const client: IAiCifraCatalogSearchClient = {
      searchVideos: jest.fn().mockResolvedValue([
        { title: "Bohemian Rhapsody", artist: "Queen", youtube_video_id: "abc123" },
      ]),
    };
    const useCase = new SearchAiCifraCatalogUseCase(client);

    const result = await useCase.execute({ query: "bohemian rhapsody" });

    expect(client.searchVideos).toHaveBeenCalledWith({
      query: "bohemian rhapsody",
      limit: 15,
    });
    expect(result).toEqual([
      { title: "Bohemian Rhapsody", artist: "Queen", youtube_video_id: "abc123" },
    ]);
  });

  it("limita o limit ao máximo permitido (25)", async () => {
    const client: IAiCifraCatalogSearchClient = {
      searchVideos: jest.fn().mockResolvedValue([]),
    };
    const useCase = new SearchAiCifraCatalogUseCase(client);

    await useCase.execute({ query: "queen", limit: 999 });

    expect(client.searchVideos).toHaveBeenCalledWith({
      query: "queen",
      limit: 25,
    });
  });

  it("rejeita query vazia", async () => {
    const client: IAiCifraCatalogSearchClient = {
      searchVideos: jest.fn(),
    };
    const useCase = new SearchAiCifraCatalogUseCase(client);

    await expect(useCase.execute({ query: "   " })).rejects.toBeInstanceOf(
      EntityValidationError,
    );
    expect(client.searchVideos).not.toHaveBeenCalled();
  });
});
