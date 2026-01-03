export type MonthSlotOutput = {
  start_at: Date;
  end_at: Date;
};

export type DaySlotsOutput = {
  date: string;
  slots: MonthSlotOutput[];
};

export type GetMonthSlotsOutput = {
  target_type: "musician" | "band";
  target_id: string;
  year: number;
  month: number;
  slot_minutes: number;
  days: DaySlotsOutput[];
};
