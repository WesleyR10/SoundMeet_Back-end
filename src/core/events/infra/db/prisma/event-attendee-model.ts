export type EventAttendeeModel = {
  id: string;
  eventId: string;
  audienceId: string;
  joinedAt: Date;
  leftAt: Date | null;
  is_active: boolean;
};
