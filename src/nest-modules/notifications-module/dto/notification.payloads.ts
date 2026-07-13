export type RequestStatusChangedPayload = {
  request_id: string;
  status: "accepted" | "rejected";
  musician_id: string;
  song_title: string;
  rejection_reason?: string | null;
  occurred_at: string;
};

export type NewRequestPayload = {
  request_id: string;
  event_id: string;
  audience_id: string;
  musician_id: string;
  song_title: string;
  artist: string | null;
  message: string | null;
  occurred_at: string;
};

export type TipReceivedPayload = {
  tip_id: string;
  musician_id: string;
  audience_id: string;
  amount: number;
  fan_name: string;
  message: string | null;
  is_anonymous: boolean;
  occurred_at: string;
};

export type ChatMessageNewPayload = {
  conversation_id: string;
  sender_id: string;
  occurred_at: string;
};
