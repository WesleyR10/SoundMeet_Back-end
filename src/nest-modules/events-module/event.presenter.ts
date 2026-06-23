import { EventStatus } from "@core/events/domain";
import { Transform } from "class-transformer";

import { EventOutput } from "../../core/events/application/use-cases/common/event-output";
import { ListEventsOutput } from "../../core/events/application/use-cases/list-events/list-events.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class EventPresenter {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  start_at: Date;
  end_at: Date;
  status: EventStatus;
  max_capacity: number | null;
  current_capacity: number;
  is_public: boolean;
  cover_charge: number | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: EventOutput) {
    this.id = output.id;
    this.establishment_id = output.establishment_id;
    this.name = output.name;
    this.description = output.description;
    this.start_at = output.start_at;
    this.end_at = output.end_at;
    this.status = output.status as EventStatus;
    this.max_capacity = output.max_capacity;
    this.current_capacity = output.current_capacity;
    this.is_public = output.is_public;
    this.cover_charge = output.cover_charge;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class EventCollectionPresenter extends CollectionPresenter {
  data: EventPresenter[];

  constructor(output: ListEventsOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new EventPresenter(i));
  }
}
