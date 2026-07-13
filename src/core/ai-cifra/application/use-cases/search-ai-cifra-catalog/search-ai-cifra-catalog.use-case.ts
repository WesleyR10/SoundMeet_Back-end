import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";

export type SearchAiCifraCatalogResultItem = {
  title: string;
  artist: string;
  youtube_video_id: string;
};

export interface IAiCifraCatalogSearchClient {
  searchVideos(input: {
    query: string;
    limit: number;
  }): Promise<SearchAiCifraCatalogResultItem[]>;
}

export type SearchAiCifraCatalogInput = {
  query: string;
  limit?: number;
};

export type SearchAiCifraCatalogOutput = SearchAiCifraCatalogResultItem[];

const MAX_LIMIT = 25;
const DEFAULT_LIMIT = 15;

export class SearchAiCifraCatalogUseCase implements IUseCase<
  SearchAiCifraCatalogInput,
  SearchAiCifraCatalogOutput
> {
  constructor(private readonly client: IAiCifraCatalogSearchClient) {}

  async execute(
    input: SearchAiCifraCatalogInput,
  ): Promise<SearchAiCifraCatalogOutput> {
    const query = String(input.query ?? "").trim();
    if (!query) {
      throw new EntityValidationError([
        { query: ["query é obrigatório."] },
      ]);
    }

    const limit =
      typeof input.limit === "number" && Number.isFinite(input.limit)
        ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(input.limit)))
        : DEFAULT_LIMIT;

    return this.client.searchVideos({ query, limit });
  }
}
