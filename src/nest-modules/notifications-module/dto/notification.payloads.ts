export type RequestStatusChangedPayload = {
  request_id: string;
  status: "accepted" | "rejected";
  musician_id: string;
  song_title: string;
  rejection_reason?: string | null;
  occurred_at: string;
};
