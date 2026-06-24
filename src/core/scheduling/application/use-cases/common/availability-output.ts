import { Availability } from "../../../domain/availability.aggregate";

export type AvailabilityRuleOutput = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: Date;
};

export type UnavailabilityOutput = {
  id: string;
  start_at: Date;
  end_at: Date;
  reason: string | null;
  created_at: Date;
};

export type AvailabilityOutput = {
  id: string;
  musician_id: string | null;
  band_id: string | null;
  timezone: string;
  default_buffer_minutes: number;
  max_shows_per_day: number | null;
  weekly_rules: AvailabilityRuleOutput[];
  unavailabilities: UnavailabilityOutput[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export class AvailabilityOutputMapper {
  static toOutput(entity: Availability): AvailabilityOutput {
    const json = entity.toJSON();
    return {
      id: json.availability_id,
      musician_id: json.musician_id,
      band_id: json.band_id,
      timezone: json.timezone,
      default_buffer_minutes: json.default_buffer_minutes,
      max_shows_per_day: json.max_shows_per_day,
      weekly_rules: json.weekly_rules.map((r) => ({
        id: r.id,
        weekday: r.weekday,
        start_time: r.start_time,
        end_time: r.end_time,
        is_available: r.is_available,
        created_at: r.created_at,
      })),
      unavailabilities: json.unavailabilities.map((u) => ({
        id: u.id,
        start_at: u.start_at,
        end_at: u.end_at,
        reason: u.reason,
        created_at: u.created_at,
      })),
      is_active: json.is_active,
      created_at: json.created_at,
      updated_at: json.updated_at,
    };
  }
}
