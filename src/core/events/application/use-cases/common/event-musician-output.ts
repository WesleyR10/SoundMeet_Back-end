import { EventMusician } from "@core/events/domain";

export type EventMusicianOutput = {
  id: string;
  event_id: string;
  musician_id: string | null;
  band_id: string | null;
  fee: number | null;
  status: string;
  start_at: Date | null;
  end_at: Date | null;
  created_at: Date;
};

export class EventMusicianOutputMapper {
  static toOutput(entity: EventMusician): EventMusicianOutput {
    return {
      id: entity.event_musician_id.id,
      event_id: entity.event_id.id,
      musician_id: entity.musician_id?.id ?? null,
      band_id: entity.band_id?.id ?? null,
      fee: entity.fee,
      status: entity.status,
      start_at: entity.start_at,
      end_at: entity.end_at,
      created_at: entity.created_at,
    };
  }
}
