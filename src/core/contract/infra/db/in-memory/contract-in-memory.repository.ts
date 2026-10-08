import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { InMemorySearchableRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import { Contract, ContractId } from "../../../domain/contract.aggregate";
import {
  ContractFilter,
  ContractSearchParams,
  ContractSearchResult,
  IContractRepository,
} from "../../../domain/contract.repository";

export class ContractInMemoryRepository
  extends InMemorySearchableRepository<Contract, ContractId, ContractFilter>
  implements IContractRepository
{
  sortableFields: string[] = ["created_at", "issued_at", "signed_at"];

  getEntity(): new (...args: any[]) => Contract {
    return Contract;
  }

  async findCurrentByBookingId(booking_id: string): Promise<Contract | null> {
    const candidates = this.items
      .filter(
        (contract) =>
          contract.booking_id.id === booking_id &&
          contract.status !== "annulled",
      )
      .sort((a, b) => b.revision - a.revision);

    return candidates[0] ?? null;
  }

  async findByVerificationCode(code: string): Promise<Contract | null> {
    return (
      this.items.find((contract) => contract.verification_code === code) ?? null
    );
  }

  async search(props: ContractSearchParams): Promise<ContractSearchResult> {
    const result = await super.search(props);
    return new ContractSearchResult({
      items: result.items,
      total: result.total,
      current_page: result.current_page,
      per_page: result.per_page,
    });
  }

  protected async applyFilter(
    items: Contract[],
    filter: ContractFilter | null,
  ): Promise<Contract[]> {
    if (!filter) return items;

    return items.filter((contract) => {
      const byBooking = filter.booking_id
        ? contract.booking_id.id === filter.booking_id
        : true;
      const byEstablishment = filter.establishment_id
        ? contract.establishment_id.id === filter.establishment_id
        : true;
      const byMusician = filter.musician_id
        ? contract.musician_id?.id === filter.musician_id
        : true;
      const byBand = filter.band_id
        ? contract.band_id?.id === filter.band_id
        : true;
      const byStatus = filter.status ? contract.status === filter.status : true;

      /*
       * 🔴 Espelha o repositório Prisma: array vazio casa com NADA.
       *
       * O `if (filter.participant_ids)` — e não um truthy-check no conteúdo — é
       * o que preserva a diferença entre "não filtrar por ator" (campo ausente)
       * e "este ator não tem identidade nenhuma" (array vazio). Confundir os
       * dois devolve a lista inteira para quem não deveria ver nada.
       */
      const byParticipant = filter.participant_ids
        ? filter.participant_ids.some(
            (id) =>
              id === contract.establishment_id.id ||
              id === contract.musician_id?.id ||
              id === contract.band_id?.id,
          )
        : true;

      return (
        byBooking &&
        byEstablishment &&
        byMusician &&
        byBand &&
        byStatus &&
        byParticipant
      );
    });
  }

  protected applySort(
    items: Contract[],
    sort: string | null,
    sort_dir: SortDirection | null,
  ): Contract[] {
    // Contrato mais recente primeiro: é o que as duas personas querem ver.
    return sort
      ? super.applySort(items, sort, sort_dir)
      : super.applySort(items, "created_at", "desc");
  }
}
