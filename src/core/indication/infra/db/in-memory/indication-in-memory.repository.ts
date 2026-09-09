import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Indication, IndicationId } from "../../../domain/indication.aggregate";
import {
  IIndicationRepository,
  IndicationFilter,
  IndicationSearchParams,
  IndicationSearchResult,
} from "../../../domain/indication.repository";

export class IndicationInMemoryRepository
  extends InMemorySearchableRepository<
    Indication,
    IndicationId,
    IndicationFilter
  >
  implements IIndicationRepository
{
  sortableFields: string[] = ["created_at", "status"];

  getEntity(): new (...args: any[]) => Indication {
    return Indication;
  }

  async findByTrio(params: {
    audience_id: string;
    musician_id: string;
    establishment_id: string;
  }): Promise<Indication | null> {
    return (
      this.items.find(
        (i) =>
          i.audience_id === params.audience_id &&
          i.musician_id === params.musician_id &&
          i.establishment_id === params.establishment_id,
      ) ?? null
    );
  }

  async countNewByEstablishment(establishment_id: string): Promise<number> {
    return this.items.filter(
      (i) => i.establishment_id === establishment_id && i.status === "new",
    ).length;
  }

  async search(props: IndicationSearchParams): Promise<IndicationSearchResult> {
    const result = await super.search(props);
    return new IndicationSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: Indication[],
    filter: IndicationFilter | null,
  ): Promise<Indication[]> {
    if (!filter) return items;

    return items.filter((i) => {
      const byAudience = filter.audience_id
        ? i.audience_id === filter.audience_id
        : true;
      const byMusician = filter.musician_id
        ? i.musician_id === filter.musician_id
        : true;
      const byEstablishment = filter.establishment_id
        ? i.establishment_id === filter.establishment_id
        : true;
      const byStatus = filter.status ? i.status === filter.status : true;

      return byAudience && byMusician && byEstablishment && byStatus;
    });
  }

  protected applySort(
    items: Indication[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ): Indication[] {
    // Caixa de entrada: a indicação mais recente primeiro.
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }
}
