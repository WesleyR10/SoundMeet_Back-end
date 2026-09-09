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

/**
 * Destaque pago do pedido musical.
 *
 * O músico aceitou e a cobrança foi criada — o fã precisa pagar para o
 * destaque valer. Carrega o QR porque este é o único momento em que o app pode
 * abrir a cobrança sem uma segunda requisição; quem estiver com o app fechado
 * relê depois em `GET /requests/:request_id/boost/payment`.
 */
export type RequestBoostPaymentReadyPayload = {
  request_id: string;
  tip_id: string;
  musician_id: string;
  song_title: string;
  amount: number;
  qr_code: string | null;
  copy_paste_code: string | null;
  expires_at: string | null;
  occurred_at: string;
};

/**
 * Pagamento confirmado — é o gatilho da celebração no app do fã.
 *
 * A dedicatória viaja aqui porque a partir deste instante ela é pública
 * (`RequestBoost.isPublic`); antes disso nenhum payload a leva para fora dos
 * participantes do pedido.
 */
export type RequestBoostPaidPayload = {
  request_id: string;
  tip_id: string;
  musician_id: string;
  song_title: string;
  dedication: string | null;
  amount: number;
  occurred_at: string;
};

/** Espelho do anterior para o músico: o card na fila vira "confirmado". */
export type RequestBoostConfirmedPayload = {
  request_id: string;
  tip_id: string;
  amount: number;
  song_title: string;
};

/**
 * Gorjeta confirmada, na direção do FÃ — gatilho da celebração no app.
 *
 * ⚠️ Um pedido com destaque dispara **os dois** eventos: este e
 * `request.boost.paid`, que é mais rico (traz música e dedicatória). O app
 * deduplica por `tip_id` e fica com o primeiro que chegar; sem isso a
 * celebração tocaria duas vezes.
 */
export type TipConfirmedPayload = {
  tip_id: string;
  musician_id: string | null;
  band_id: string | null;
  amount: number;
  message: string | null;
  occurred_at: string;
};
