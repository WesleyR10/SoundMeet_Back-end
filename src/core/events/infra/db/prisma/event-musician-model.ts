import { EventMusicianStatus } from "@prisma/client";

export type EventMusicianModel = {
  id: string;
  eventId: string;
  musicianId: string | null;
  bandId: string | null;
  fee: number | null;
  status: EventMusicianStatus;
  startTime: Date | null;
  endTime: Date | null;
  created_at: Date;
};
