import { Event } from "@core/events/domain";

export type EventOutput = {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  start_at: Date;
  end_at: Date;
  status: string;
  max_capacity: number | null;
  current_capacity: number;
  is_public: boolean;
  cover_charge: number | null;
  created_at: Date;
  updated_at: Date;
};

export class EventOutputMapper {
  static toOutput(entity: Event): EventOutput {
    return {
      id: entity.event_id.id,
      establishment_id: entity.establishment_id.id,
      name: entity.name,
      description: entity.description,
      start_at: entity.start_at,
      end_at: entity.end_at,
      status: entity.status,
      max_capacity: entity.max_capacity,
      current_capacity: entity.current_capacity,
      is_public: entity.is_public,
      cover_charge: entity.cover_charge,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
