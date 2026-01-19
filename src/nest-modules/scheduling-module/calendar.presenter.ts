import { Transform } from "class-transformer";

export class BusyIntervalPresenter {
  @Transform(({ value }: { value: Date }) => value.toISOString())
  start_at: Date;

  @Transform(({ value }: { value: Date }) => value.toISOString())
  end_at: Date;

  kind: "booking" | "unavailability";
  booking_id?: string;
  reason?: string | null;
  status?: string;
}

export class GetFreeBusyPresenter {
  target_type: "musician" | "band";
  target_id: string;

  @Transform(({ value }: { value: Date }) => value.toISOString())
  start_at: Date;

  @Transform(({ value }: { value: Date }) => value.toISOString())
  end_at: Date;

  busy: BusyIntervalPresenter[];
}

export class MonthSlotPresenter {
  @Transform(({ value }: { value: Date }) => value.toISOString())
  start_at: Date;

  @Transform(({ value }: { value: Date }) => value.toISOString())
  end_at: Date;
}

export class DaySlotsPresenter {
  date: string;
  slots: MonthSlotPresenter[];
}

export class GetMonthSlotsPresenter {
  target_type: "musician" | "band";
  target_id: string;
  year: number;
  month: number;
  slot_minutes: number;
  days: DaySlotsPresenter[];
}
