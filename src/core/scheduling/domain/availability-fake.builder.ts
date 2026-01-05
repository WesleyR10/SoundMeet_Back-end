import { Uuid } from "../../shared/domain";
import { Availability, AvailabilityId } from "./availability.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class AvailabilityFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<AvailabilityId> | undefined = undefined;
  private _musician_id: PropOrFactory<Uuid | null> | undefined = undefined;
  private _band_id: PropOrFactory<Uuid | null> | undefined = undefined;
  private _timezone: PropOrFactory<string> | undefined = undefined;
  private _default_buffer_minutes: PropOrFactory<number> | undefined =
    undefined;
  private _max_shows_per_day: PropOrFactory<number | null> | undefined =
    undefined;
  private _weekly_rules:
    | PropOrFactory<
        Array<{
          weekday: number;
          start_time: string;
          end_time: string;
          is_available?: boolean;
        }>
      >
    | undefined = undefined;
  private _unavailabilities:
    | PropOrFactory<
        Array<{
          start_at: Date;
          end_at: Date;
          reason?: string | null;
        }>
      >
    | undefined = undefined;
  private _is_active: PropOrFactory<boolean> | undefined = undefined;

  private countObjs: number;

  static aAvailability() {
    return new AvailabilityFakeBuilder<Availability>(1);
  }

  static theAvailabilities(countObjs: number) {
    return new AvailabilityFakeBuilder<Availability[]>(countObjs);
  }

  constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
  }

  withAvailabilityId(id: PropOrFactory<AvailabilityId>) {
    this._id = id;
    return this;
  }

  withMusicianId(musician_id: PropOrFactory<Uuid | null>) {
    this._musician_id = musician_id;
    return this;
  }

  withBandId(band_id: PropOrFactory<Uuid | null>) {
    this._band_id = band_id;
    return this;
  }

  withTimezone(timezone: PropOrFactory<string>) {
    this._timezone = timezone;
    return this;
  }

  withDefaultBufferMinutes(default_buffer_minutes: PropOrFactory<number>) {
    this._default_buffer_minutes = default_buffer_minutes;
    return this;
  }

  withMaxShowsPerDay(max_shows_per_day: PropOrFactory<number | null>) {
    this._max_shows_per_day = max_shows_per_day;
    return this;
  }

  withWeeklyRules(
    weekly_rules: PropOrFactory<
      Array<{
        weekday: number;
        start_time: string;
        end_time: string;
        is_available?: boolean;
      }>
    >,
  ) {
    this._weekly_rules = weekly_rules;
    return this;
  }

  withUnavailabilities(
    unavailabilities: PropOrFactory<
      Array<{
        start_at: Date;
        end_at: Date;
        reason?: string | null;
      }>
    >,
  ) {
    this._unavailabilities = unavailabilities;
    return this;
  }

  activate() {
    this._is_active = true;
    return this;
  }

  deactivate() {
    this._is_active = false;
    return this;
  }

  build(): TBuild {
    const availabilities = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const musician_id =
          this._musician_id !== undefined
            ? this.callFactory(this._musician_id, index)
            : new Uuid();
        const band_id =
          this._band_id !== undefined
            ? this.callFactory(this._band_id, index)
            : null;

        const unavailabilities =
          this._unavailabilities !== undefined
            ? this.callFactory(this._unavailabilities, index)
            : [];

        const is_active =
          this._is_active !== undefined
            ? this.callFactory(this._is_active, index)
            : true;

        const timezone =
          this._timezone !== undefined
            ? this.callFactory(this._timezone, index)
            : "UTC";

        const default_buffer_minutes =
          this._default_buffer_minutes !== undefined
            ? this.callFactory(this._default_buffer_minutes, index)
            : 0;

        const max_shows_per_day =
          this._max_shows_per_day !== undefined
            ? this.callFactory(this._max_shows_per_day, index)
            : null;

        const weekly_rules =
          this._weekly_rules !== undefined
            ? this.callFactory(this._weekly_rules, index)
            : [];

        const entity = new Availability({
          id: !this._id ? undefined : this.callFactory(this._id, index),
          musician_id: musician_id?.id ?? null,
          band_id: band_id?.id ?? null,
          timezone,
          default_buffer_minutes,
          max_shows_per_day,
          weekly_rules,
          unavailabilities,
          is_active,
        });
        entity.validate();

        return entity;
      });

    return this.countObjs === 1
      ? (availabilities[0] as any)
      : (availabilities as any);
  }

  private callFactory<T>(prop: PropOrFactory<T>, index: number): T {
    return typeof prop === "function" ? (prop as any)(index) : prop;
  }
}
