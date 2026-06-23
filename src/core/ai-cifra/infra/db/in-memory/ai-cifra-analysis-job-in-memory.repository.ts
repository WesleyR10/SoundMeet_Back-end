import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  AiCifraAnalysisJob,
  AiCifraAnalysisJobId,
} from "../../../domain/ai-cifra-analysis-job.aggregate";
import {
  AiCifraAnalysisJobFilter,
  AiCifraAnalysisJobSearchParams,
  AiCifraAnalysisJobSearchResult,
  IAiCifraAnalysisJobRepository,
} from "../../../domain/ai-cifra-analysis-job.repository";

export class AiCifraAnalysisJobInMemoryRepository
  extends InMemorySearchableRepository<
    AiCifraAnalysisJob,
    AiCifraAnalysisJobId,
    AiCifraAnalysisJobFilter
  >
  implements IAiCifraAnalysisJobRepository
{
  sortableFields: string[] = [
    "created_at",
    "updated_at",
    "status",
    "progress_percent",
  ];

  async search(
    props: AiCifraAnalysisJobSearchParams,
  ): Promise<AiCifraAnalysisJobSearchResult> {
    const result = await super.search(props);
    return new AiCifraAnalysisJobSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: AiCifraAnalysisJob[],
    filter: AiCifraAnalysisJobFilter | null,
  ): Promise<AiCifraAnalysisJob[]> {
    if (!filter) return items;
    return items.filter((item) => {
      if (filter.musician_id && item.musician_id.id !== filter.musician_id) {
        return false;
      }
      if (
        filter.ai_cifra_upload_id &&
        item.ai_cifra_upload_id.id !== filter.ai_cifra_upload_id
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

  getEntity(): new (...args: any[]) => AiCifraAnalysisJob {
    return AiCifraAnalysisJob;
  }
}
