import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";

import {
  AvailabilityOutput,
  AvailabilityRuleOutput,
  UnavailabilityOutput,
} from "../../core/scheduling/application/use-cases/common/availability-output";

export class AvailabilityRulePresenter implements AvailabilityRuleOutput {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;

  constructor(r: AvailabilityRuleOutput) {
    Object.assign(this, r);
  }
}

export class UnavailabilityPresenter implements UnavailabilityOutput {
  id: string;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  start_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  end_at: Date;
  reason: string | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;

  constructor(u: UnavailabilityOutput) {
    Object.assign(this, u);
  }
}

export class AvailabilityPresenter {
  id: string;
  musician_id: string | null;
  band_id: string | null;
  timezone: string;
  default_buffer_minutes: number;
  max_shows_per_day: number | null;

  @ApiProperty({ type: [AvailabilityRulePresenter] })
  @Type(() => AvailabilityRulePresenter)
  weekly_rules: AvailabilityRulePresenter[];

  @ApiProperty({ type: [UnavailabilityPresenter] })
  @Type(() => UnavailabilityPresenter)
  unavailabilities: UnavailabilityPresenter[];

  is_active: boolean;

  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;

  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: AvailabilityOutput) {
    this.id = output.id;
    this.musician_id = output.musician_id;
    this.band_id = output.band_id;
    this.timezone = output.timezone;
    this.default_buffer_minutes = output.default_buffer_minutes;
    this.max_shows_per_day = output.max_shows_per_day;
    this.weekly_rules = output.weekly_rules.map(
      (r) => new AvailabilityRulePresenter(r),
    );
    this.unavailabilities = output.unavailabilities.map(
      (u) => new UnavailabilityPresenter(u),
    );
    this.is_active = output.is_active;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}
