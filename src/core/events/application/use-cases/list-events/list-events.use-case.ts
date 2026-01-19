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
  establishment_id: string;
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: Omit<EventFilter, "establishment_id"> | null;
};

export type ListEventsOutput = PaginationOutput<EventOutput>;

export class ListEventsUseCase implements IUseCase<
  ListEventsInput,
  ListEventsOutput
> {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(input: ListEventsInput): Promise<ListEventsOutput> {
    const params = EventSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        ...(input.filter ?? null),
        establishment_id: input.establishment_id,
      } as any,
    });
    const searchResult = await this.eventRepo.search(params);
    const items = searchResult.items.map((i) => EventOutputMapper.toOutput(i));
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}
