import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  AiCifraUpload,
  AiCifraUploadId,
} from "../../../domain/ai-cifra-upload.aggregate";
import {
  AiCifraUploadFilter,
  AiCifraUploadSearchParams,
  AiCifraUploadSearchResult,
  IAiCifraUploadRepository,
} from "../../../domain/ai-cifra-upload.repository";

export class AiCifraUploadInMemoryRepository
  extends InMemorySearchableRepository<
    AiCifraUpload,
    AiCifraUploadId,
    AiCifraUploadFilter
  >
  implements IAiCifraUploadRepository
{
  sortableFields: string[] = ["created_at", "updated_at", "status"];

  async search(
    props: AiCifraUploadSearchParams,
  ): Promise<AiCifraUploadSearchResult> {
    const result = await super.search(props);
    return new AiCifraUploadSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: AiCifraUpload[],
    filter: AiCifraUploadFilter | null,
  ): Promise<AiCifraUpload[]> {
    if (!filter) return items;
    return items.filter((item) => {
      if (filter.musician_id && item.musician_id.id !== filter.musician_id) {
        return false;
      }
      if (filter.status && item.status !== filter.status) {
        return false;
      }
      if (
        filter.updated_at_lte &&
        item.updated_at.getTime() > filter.updated_at_lte.getTime()
      ) {
        return false;
      }
      return true;
    });
  }

  getEntity(): new (...args: any[]) => AiCifraUpload {
    return AiCifraUpload;
  }
}
