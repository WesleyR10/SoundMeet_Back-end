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
  genres: string[];
  instruments: string[];
  experience_years: number | null;
  qr_code: string | null;
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
  profile?: MusicianProfileModel | null;
};

export type MusicianProfileModel = {
  id: string;
  musicianId: string;
  price_model: string | null;
  price_min: number | null;
  price_max: number | null;
  price_currency: CurrencyDb | null;
  price_notes: string | null;
  location: JsonValue;
  socialLinks: JsonValue | null;
  experience: number;
  instruments: string[];
  genres: string[];
  rating: number;
  totalRatings: number;
  created_at: Date;
  updated_at: Date;
};
