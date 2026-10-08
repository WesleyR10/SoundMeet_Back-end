import {
  EventFilter,
  EventSearchParams,
  IEventRepository,
} from "@core/events/domain";

import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { EventOutput, EventOutputMapper } from "../common/event-output";

export type ListEventsInput = {
  establishment_id?: string;
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: Omit<EventFilter, "establishment_id"> | null;
  /**
   * Claim `establishment_ids` de quem está lendo (Bloco 9.4d). A rota é
   * `@Public()` com soft-auth: anônimo e terceiro só enxergam evento público;
   * o dono continua vendo os privados no próprio dashboard.
   */
  requesting_establishment_ids?: string[] | null;
  is_admin?: boolean;
};

export type ListEventsOutput = PaginationOutput<EventOutput>;

export class ListEventsUseCase implements IUseCase<
  ListEventsInput,
  ListEventsOutput
> {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(input: ListEventsInput): Promise<ListEventsOutput> {
    const filter: EventFilter = { ...(input.filter ?? null) };

    if (input.establishment_id) {
      filter.establishment_id = input.establishment_id;

      // Bloco 9.4d — vazamento corrigido. Antes, pinar establishment_id
      // desligava a proteção e QUALQUER pessoa listava os eventos privados
      // daquele estabelecimento só sabendo o UUID (a rota é @Public()).
      // Agora o filtro só é liberado para quem opera o estabelecimento.
      if (!canSeePrivateEvents(input, input.establishment_id)) {
        filter.is_public = true;
      }
    } else {
      // Discovery pública cross-establishment (7.13b): sem establishment_id
      // pinado, nunca expõe eventos privados — força is_public mesmo que o
      // cliente mande false.
      filter.is_public = true;
    }

    const params = EventSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter,
    });
    const searchResult = await this.eventRepo.search(params);
    const items = searchResult.items.map((i) => EventOutputMapper.toOutput(i));
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}

/**
 * Só o dono do estabelecimento (ou admin) enxerga evento privado. O id do
 * estabelecimento vem da URL e não autoriza nada — quem autoriza é o claim
 * `establishment_ids` do token.
 */
function canSeePrivateEvents(
  input: ListEventsInput,
  establishmentId: string,
): boolean {
  if (input.is_admin) return true;
  return (input.requesting_establishment_ids ?? []).includes(establishmentId);
}
