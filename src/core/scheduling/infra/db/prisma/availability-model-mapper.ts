import { Uuid } from "../../../../shared/domain";
import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  Availability,
  AvailabilityId,
} from "../../../domain/availability.aggregate";

export type AvailabilitySettingsModel = {
  id: string;
  musicianId?: string | null;
  bandId?: string | null;
  timezone: string;
  default_buffer_minutes: number;
  max_shows_per_day: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type AvailabilityRuleModel = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: Date;
};

export type UnavailabilityModel = {
  id: string;
  start_at: Date;
  end_at: Date;
  reason: string | null;
  created_at: Date;
};

export class AvailabilityModelMapper {
  static toEntity(
    settings: AvailabilitySettingsModel,
    weeklyRules: AvailabilityRuleModel[],
    unavailabilities: UnavailabilityModel[],
  ): Availability {
    const entity = new Availability({
      availability_id: new AvailabilityId(settings.id),
      musician_id: settings.musicianId ?? null,
      band_id: settings.bandId ?? null,
      timezone: settings.timezone,
      default_buffer_minutes: settings.default_buffer_minutes,
      max_shows_per_day: settings.max_shows_per_day,
      weekly_rules: weeklyRules.map((rule) => ({
        id: new Uuid(rule.id),
        weekday: rule.weekday,
        start_time: rule.start_time,
        end_time: rule.end_time,
        is_available: rule.is_available,
        created_at: rule.created_at,
      })),
      is_active: settings.is_active,
      created_at: settings.created_at,
      updated_at: settings.updated_at,
      unavailabilities: unavailabilities.map((unavailability) => ({
        id: new Uuid(unavailability.id),
        start_at: unavailability.start_at,
        end_at: unavailability.end_at,
        reason: unavailability.reason ?? null,
        created_at: unavailability.created_at,
      })),
    });

    entity.validate();
    if (entity.notification.hasErrors()) {
      throw new LoadEntityError(entity.notification.toJSON());
    }

    return entity;
  }
}
