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

/**
 * Bloco 9.5 — agenda. Serve tanto o músico (room `user:<sub>`) quanto o
 * estabelecimento (room `establishment:<id>`), com o mesmo formato: o
 * dashboard web e o app reagem ao mesmo evento.
 */
export type BookingUpdatePayload = {
  booking_id: string;
  status: "confirmed" | "cancelled";
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  start_at: string;
  end_at: string;
  cancelled_by?: string | null;
  occurred_at: string;
};

export type InquiryUpdatePayload = {
  inquiry_id: string;
  status: "created" | "accepted" | "rejected";
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  subject: string | null;
  occurred_at: string;
};
