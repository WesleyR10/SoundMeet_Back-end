import {
  Event,
  EventAttendeeFilter,
  EventAttendeeSearchParams,
  EventId,
  IEventAttendeeRepository,
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
  EventAttendeeOutput,
  EventAttendeeOutputMapper,
} from "../common/event-attendee-output";

export type ListEventAttendeesInput = {
  establishment_id: string;
  event_id: string;
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: Omit<EventAttendeeFilter, "event_id"> | null;
};

export type ListEventAttendeesOutput = PaginationOutput<EventAttendeeOutput>;

export class ListEventAttendeesUseCase implements IUseCase<
  ListEventAttendeesInput,
  ListEventAttendeesOutput
> {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly eventAttendeeRepo: IEventAttendeeRepository,
  ) {}

  async execute(
    input: ListEventAttendeesInput,
  ): Promise<ListEventAttendeesOutput> {
    const eventId = new EventId(input.event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event || event.establishment_id.id !== input.establishment_id) {
      throw new NotFoundError(input.event_id, Event);
    }

    const params = EventAttendeeSearchParams.create({
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      sort_dir: input.sort_dir,
      filter: {
        ...(input.filter ?? null),
        event_id: input.event_id,
      } as any,
    });

    const searchResult = await this.eventAttendeeRepo.search(params);
    const items = searchResult.items.map((i) =>
      EventAttendeeOutputMapper.toOutput(i),
    );
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}
