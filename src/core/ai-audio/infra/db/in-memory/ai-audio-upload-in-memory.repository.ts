import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  AiAudioUpload,
  AiAudioUploadId,
} from "../../../domain/ai-audio-upload.aggregate";
import {
  AiAudioUploadFilter,
  AiAudioUploadSearchParams,
  AiAudioUploadSearchResult,
  IAiAudioUploadRepository,
} from "../../../domain/ai-audio-upload.repository";

export class AiAudioUploadInMemoryRepository
  extends InMemorySearchableRepository<
    AiAudioUpload,
    AiAudioUploadId,
    AiAudioUploadFilter
  >
  implements IAiAudioUploadRepository
{
  sortableFields: string[] = ["created_at", "updated_at", "status"];

  async search(
    props: AiAudioUploadSearchParams,
  ): Promise<AiAudioUploadSearchResult> {
    const result = await super.search(props);
    return new AiAudioUploadSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: AiAudioUpload[],
    filter: AiAudioUploadFilter | null,
  ): Promise<AiAudioUpload[]> {
    if (!filter) {
      return items;
    }
    return items.filter((item) => {
      if (filter.musician_id && item.musician_id.id !== filter.musician_id) {
        return false;
      }
      if (filter.status && item.status !== filter.status) {
        return false;
      }
      return true;
    });
  }

  getEntity(): new (...args: any[]) => AiAudioUpload {
    return AiAudioUpload;
  }
}
