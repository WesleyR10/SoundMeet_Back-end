export type BusyIntervalOutput = {
  start_at: Date;
  end_at: Date;
  kind: "booking" | "unavailability";
  booking_id?: string;
  reason?: string | null;
  status?: string;
};

export type GetFreeBusyOutput = {
  target_type: "musician" | "band";
  target_id: string;
  start_at: Date;
  end_at: Date;
  busy: BusyIntervalOutput[];
};
