import { EventStatus } from "@prisma/client";

export type EventModel = {
  id: string;
  establishmentId: string;
  name: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  status: EventStatus;
  maxCapacity: number | null;
  currentCapacity: number;
  isPublic: boolean;
  coverCharge: number | null;
  created_at: Date;
  updated_at: Date;
};
