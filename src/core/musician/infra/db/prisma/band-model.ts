import { JsonValue } from "./musician-model";

export type CurrencyDb = "BRL" | "USD" | "EUR";

export type BandMemberStatusDb = "pending" | "accepted" | "declined";

export type BandMemberModel = {
  id: string;
  musicianId: string;
  role: string;
  instrument: string;
  status: BandMemberStatusDb;
  joinedAt: Date;
  responded_at: Date | null;
};

export type BandModel = {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  genres: string[];
  qr_code: string | null;
  price_model: string | null;
  price_min: number | null;
  price_max: number | null;
  price_currency: CurrencyDb | null;
  price_notes: string | null;
  open_to_gigs: boolean | null;
  address: JsonValue | null;
  location_lat: number | null;
  location_lng: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  members?: BandMemberModel[];
};
