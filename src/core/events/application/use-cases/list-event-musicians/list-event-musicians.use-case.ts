import {
  Event,
  EventId,
  EventMusicianFilter,
  EventMusicianSearchParams,
  IEventMusicianRepository,
  IEventRepository,
} from "@core/events/domain";

import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import {
  EventMusicianOutput,
  EventMusicianOutputMapper,
} from "../common/event-musician-output";

export type ListEventMusiciansInput = {
  establishment_id: string;
  event_id: string;
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: Omit<EventMusicianFilter, "event_id"> | null;
};

export type ListEventMusiciansOutput = PaginationOutput<EventMusicianOutput>;

export class ListEventMusiciansUseCase implements IUseCase<
  ListEventMusiciansInput,
  ListEventMusiciansOutput
> {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly eventMusicianRepo: IEventMusicianRepository,
  ) {}

  async execute(
    input: ListEventMusiciansInput,
  ): Promise<ListEventMusiciansOutput> {
    const eventId = new EventId(input.event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event || event.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }

    const params = EventMusicianSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        ...(input.filter ?? null),
        event_id: input.event_id,
      } as any,
    });

    const searchResult = await this.eventMusicianRepo.search(params);
    const items = searchResult.items.map((i) =>
      EventMusicianOutputMapper.toOutput(i),
    );
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}
