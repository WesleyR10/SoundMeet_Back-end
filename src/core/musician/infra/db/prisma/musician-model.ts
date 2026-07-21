export type CurrencyDb = "BRL" | "USD" | "EUR";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue | undefined };
export type JsonArray = JsonValue[];

export type MusicianModel = {
  id: string;
  email: string;
  name: string;
  stage_name: string | null;
  bio: string | null;
  avatar: string | null;
  phone: string | null;
  cpf: string | null;
  genres: string[];
  instruments: string[];
  experience_years: number | null;
  qr_code: string | null;
  qr_foreground_color?: string | null;
  qr_background_color?: string | null;
  qr_logo_url?: string | null;
  qr_label?: string | null;
  push_token?: string | null;
  push_token_platform?: string | null;
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  open_to_gigs: boolean | null;
  email_verified_at?: Date | null;
  email_pending?: string | null;
  email_token?: string | null;
  email_token_expires_at?: Date | null;
  created_at: Date;
  updated_at: Date;
  profile?: MusicianProfileModel | null;
};

export type MusicianProfileModel = {
  id: string;
  musicianId: string;
  // Colunas legadas (modelo único) — mantidas até a migration de remoção;
  // a fonte de verdade passou a ser os pares price_hour_* / price_event_*.
  price_model: string | null;
  price_min: number | null;
  price_max: number | null;
  price_currency: CurrencyDb | null;
  price_notes: string | null;
  price_hour_min: number | null;
  price_hour_max: number | null;
  price_hour_notes: string | null;
  price_event_min: number | null;
  price_event_max: number | null;
  price_event_notes: string | null;
  location: JsonValue;
  // Denormalizado do JSON `location` para o pré-filtro da busca por raio
  // (7.13c) — escrito pelo mapper a cada save; leitura continua pelo JSON.
  location_lat: number | null;
  location_lng: number | null;
  // Modo turnê (7.13d) — segundo ponto de busca, opcional e com expiração
  // automática, somado à base permanente (nunca a substitui).
  touring_location: JsonValue | null;
  touring_lat: number | null;
  touring_lng: number | null;
  touring_expires_at: Date | null;
  socialLinks: JsonValue | null;
  created_at: Date;
  updated_at: Date;
};
