import { Uuid } from "../../../../shared/domain";
import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Event, EventId } from "../../../domain";
import { EventModel } from "./event-model";

export type EventModelProps = EventModel;

export class EventModelMapper {
  static toModel(entity: Event): EventModel {
    return {
      id: entity.event_id.id,
      establishmentId: entity.establishment_id.id,
      name: entity.name,
      description: entity.description,
      date: entity.date,
      startTime: entity.start_at,
      endTime: entity.end_at,
      status: entity.status,
      maxCapacity: entity.max_capacity,
      currentCapacity: entity.current_capacity,
      isPublic: entity.is_public,
      coverCharge: entity.cover_charge,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: EventModel): Event {
    const entity = new Event({
      event_id: new EventId(model.id),
      establishment_id: new Uuid(model.establishmentId),
      name: model.name,
      description: model.description,
      date: model.date,
      start_at: model.startTime,
      end_at: model.endTime,
      status: model.status as any,
      max_capacity: model.maxCapacity,
      current_capacity: model.currentCapacity,
      is_public: model.isPublic,
      cover_charge: model.coverCharge,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    entity.validate();
    if (entity.notification.hasErrors()) {
      throw new LoadEntityError(entity.notification.toJSON());
    }

    return entity;
  }
}
