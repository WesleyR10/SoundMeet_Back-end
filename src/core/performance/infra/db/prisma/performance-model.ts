export type PerformedSongModel = {
  id: string;
  performanceId: string;
  libraryId: string | null;
  requestId: string | null;
  title: string;
  artist: string;
  spotifyTrackId: string | null;
  position: number;
  startedAt: Date;
  endedAt: Date | null;
  created_at: Date;
};

export type PerformanceModel = {
  id: string;
  eventId: string;
  establishmentId: string;
  musicianId: string;
  bandId: string | null;
  repertoireId: string | null;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  created_at: Date;
  updated_at: Date;
  songs?: PerformedSongModel[];
};
