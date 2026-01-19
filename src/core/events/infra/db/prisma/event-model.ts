export type EventModel = {
  id: string;
  establishmentId: string;
  name: string;
  description: string | null;
  date: Date;
  startTime: Date;
  endTime: Date;
  status: string;
  maxCapacity: number | null;
  currentCapacity: number;
  isPublic: boolean;
  coverCharge: number | null;
  created_at: Date;
  updated_at: Date;
};
