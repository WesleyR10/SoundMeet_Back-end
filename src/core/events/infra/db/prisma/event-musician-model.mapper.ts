import { Uuid } from "../../../../shared/domain";
import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  EventMusician,
  EventMusicianId,
  EventMusicianStatus,
} from "../../../domain";
import { EventMusicianModel } from "./event-musician-model";

export class EventMusicianModelMapper {
  static toModel(entity: EventMusician): EventMusicianModel {
    return {
      id: entity.event_musician_id.id,
      eventId: entity.event_id.id,
      musicianId: entity.musician_id?.id ?? null,
      bandId: entity.band_id?.id ?? null,
      fee: entity.fee,
      status: entity.status,
      startTime: entity.start_at,
      endTime: entity.end_at,
      created_at: entity.created_at,
    };
  }

  static toEntity(model: EventMusicianModel): EventMusician {
    const entity = new EventMusician({
      event_musician_id: new EventMusicianId(model.id),
      event_id: new Uuid(model.eventId),
      musician_id: model.musicianId ? new Uuid(model.musicianId) : null,
      band_id: model.bandId ? new Uuid(model.bandId) : null,
      fee: model.fee,
      status: model.status as EventMusicianStatus,
      start_at: model.startTime,
      end_at: model.endTime,
      created_at: model.created_at,
    });

    entity.validate();
    if (entity.notification.hasErrors()) {
      throw new LoadEntityError(entity.notification.toJSON());
    }

    return entity;
  }
}
