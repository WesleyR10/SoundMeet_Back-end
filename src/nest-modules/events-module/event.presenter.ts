import { EventStatus } from "@core/events/domain";
import { Transform } from "class-transformer";

import { EventAttendeeOutput } from "../../core/events/application/use-cases/common/event-attendee-output";
import { EventMusicianOutput } from "../../core/events/application/use-cases/common/event-musician-output";
import { EventOutput } from "../../core/events/application/use-cases/common/event-output";
import { ListEventAttendeesOutput } from "../../core/events/application/use-cases/list-event-attendees/list-event-attendees.use-case";
import { ListEventMusiciansOutput } from "../../core/events/application/use-cases/list-event-musicians/list-event-musicians.use-case";
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

export class EventAttendeePresenter {
  id: string;
  event_id: string;
  audience_id: string;
  joined_at: Date;
  left_at: Date | null;
  is_active: boolean;

  constructor(output: EventAttendeeOutput) {
    this.id = output.id;
    this.event_id = output.event_id;
    this.audience_id = output.audience_id;
    this.joined_at = output.joined_at;
    this.left_at = output.left_at;
    this.is_active = output.is_active;
  }
}

export class EventAttendeeCollectionPresenter extends CollectionPresenter {
  data: EventAttendeePresenter[];

  constructor(output: ListEventAttendeesOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new EventAttendeePresenter(i));
  }
}

export class EventMusicianPresenter {
  id: string;
  event_id: string;
  musician_id: string | null;
  band_id: string | null;
  fee: number | null;
  status: string;
  start_at: Date | null;
  end_at: Date | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;

  constructor(output: EventMusicianOutput) {
    this.id = output.id;
    this.event_id = output.event_id;
    this.musician_id = output.musician_id;
    this.band_id = output.band_id;
    this.fee = output.fee;
    this.status = output.status;
    this.start_at = output.start_at;
    this.end_at = output.end_at;
    this.created_at = output.created_at;
  }
}

export class EventMusicianCollectionPresenter extends CollectionPresenter {
  data: EventMusicianPresenter[];

  constructor(output: ListEventMusiciansOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new EventMusicianPresenter(i));
  }
}
