import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  AiAudioSeparationJob,
  AiAudioSeparationJobId,
} from "../../../domain/ai-audio-separation-job.aggregate";
import {
  AiAudioSeparationJobFilter,
  AiAudioSeparationJobSearchParams,
  AiAudioSeparationJobSearchResult,
  IAiAudioSeparationJobRepository,
} from "../../../domain/ai-audio-separation-job.repository";

export class AiAudioSeparationJobInMemoryRepository
  extends InMemorySearchableRepository<
    AiAudioSeparationJob,
    AiAudioSeparationJobId,
    AiAudioSeparationJobFilter
  >
  implements IAiAudioSeparationJobRepository
{
  sortableFields: string[] = ["created_at", "updated_at", "status"];

  async search(
    props: AiAudioSeparationJobSearchParams,
  ): Promise<AiAudioSeparationJobSearchResult> {
    const result = await super.search(props);
    return new AiAudioSeparationJobSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: AiAudioSeparationJob[],
    filter: AiAudioSeparationJobFilter | null,
  ): Promise<AiAudioSeparationJob[]> {
    if (!filter) {
      return items;
    }
    return items.filter((item) => {
      if (filter.musician_id && item.musician_id.id !== filter.musician_id) {
        return false;
      }
      if (
        filter.ai_audio_upload_id &&
        item.ai_audio_upload_id.id !== filter.ai_audio_upload_id
      ) {
        return false;
      }
      if (filter.status && item.status !== filter.status) {
        return false;
      }
      if (filter.model_id && item.model_id !== filter.model_id) {
        return false;
      }
      return true;
    });
  }

  getEntity(): new (...args: any[]) => AiAudioSeparationJob {
    return AiAudioSeparationJob;
  }
}
