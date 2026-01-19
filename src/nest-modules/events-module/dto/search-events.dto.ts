import { EventFilter } from "@core/events/domain";

import { ListEventsInput } from "../../../core/events/application/use-cases/list-events/list-events.use-case";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";

export class SearchEventsDto implements Omit<
  ListEventsInput,
  "establishment_id"
> {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: Omit<EventFilter, "establishment_id"> | null;
}
